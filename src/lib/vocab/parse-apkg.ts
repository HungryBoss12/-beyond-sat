import { unzipSync } from "fflate";
import {
  firstLine,
  guessPartOfSpeech,
  parseSynonymsField,
  stripAnkiHtml,
} from "./anki-html";
import type { GeneratedVocabItem } from "./types";

type SqlJs = typeof import("sql.js");
type Database = InstanceType<SqlJs["Database"]>;

export type ApkgParseResult = {
  deckName: string;
  items: GeneratedVocabItem[];
  warnings: string[];
  skipped: number;
  noteCount: number;
};

type AnkiModel = {
  name?: string;
  flds?: { name?: string }[];
};

type AnkiDeck = {
  name?: string;
};

let sqlReady: SqlJs | null = null;

async function getSql(): Promise<SqlJs> {
  if (!sqlReady) {
    const initSqlJs = (await import("sql.js/dist/sql-wasm.js")).default as (
      config?: { locateFile?: (file: string) => string },
    ) => Promise<SqlJs>;
    sqlReady = await initSqlJs({
      locateFile: () => "/sql-wasm.wasm",
    });
  }
  return sqlReady;
}

const COLLECTION_NAMES = ["collection.anki21", "collection.anki2", "collection.anki21b"];

function findCollectionDb(files: Record<string, Uint8Array>): { name: string; data: Uint8Array } {
  for (const name of COLLECTION_NAMES) {
    if (files[name]) return { name, data: files[name] };
  }
  const match = Object.keys(files).find((k) => /collection\.anki/i.test(k));
  if (match) return { name: match, data: files[match] };
  throw new Error("No Anki collection database found in this file. Is it a valid .apkg or .colpkg?");
}

function readDeckName(decksJson: string): string {
  try {
    const decks = JSON.parse(decksJson) as Record<string, AnkiDeck>;
    const names = Object.values(decks)
      .map((d) => d.name?.trim())
      .filter(Boolean) as string[];
    if (names.length === 0) return "Imported Anki deck";
    if (names.length === 1) return names[0];
    return names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
  } catch {
    return "Imported Anki deck";
  }
}

function fieldIndex(model: AnkiModel, ...candidates: string[]): number {
  const flds = model.flds ?? [];
  const lower = candidates.map((c) => c.toLowerCase());
  const hit = flds.findIndex((f) => lower.includes((f.name ?? "").toLowerCase()));
  return hit >= 0 ? hit : -1;
}

function placeholderQuiz(word: string, definition: string): GeneratedVocabItem["quizQuestion"] {
  const w = word.trim() || "word";
  return {
    passageText: `The author's precise use of the word "${w}" contributes to the passage's meaning.`,
    options: [w, "however", "therefore", "although"],
    correctAnswer: w,
    explanation: definition.slice(0, 500) || `The context supports "${w}".`,
  };
}

/** Map one Anki note row to our vocab card shape. */
export function mapAnkiNoteToVocabItem(input: {
  flds: string;
  tags: string;
  model: AnkiModel;
}): GeneratedVocabItem | null {
  const parts = input.flds.split("\u001f");
  if (parts.every((p) => !p.trim())) return null;

  const frontIdx = fieldIndex(input.model, "Front", "Word", "Term", "Question");
  const backIdx = fieldIndex(input.model, "Back", "Definition", "Meaning", "Answer");
  const extraIdx = fieldIndex(input.model, "Extra", "Example", "Context", "Sentence", "Note");

  const frontRaw = stripAnkiHtml(parts[frontIdx >= 0 ? frontIdx : 0] ?? "");
  const backRaw = stripAnkiHtml(parts[backIdx >= 0 ? backIdx : 1] ?? parts[0] ?? "");
  const extraRaw =
    extraIdx >= 0 ? stripAnkiHtml(parts[extraIdx] ?? "") : stripAnkiHtml(parts[2] ?? "");

  const word = firstLine(frontRaw).slice(0, 120);
  const definition = backRaw || frontRaw;
  if (!word || !definition) return null;

  const synonyms = parseSynonymsField(extraRaw);
  const passage =
    extraRaw.length > 40 && extraRaw.length < 600
      ? extraRaw
      : `In academic writing, the word "${word}" often appears when authors ${definition.slice(0, 80).toLowerCase()}…`;

  return {
    word,
    partOfSpeech: guessPartOfSpeech(input.tags, definition),
    definition,
    dSatPassage: passage,
    rootsEtymology: undefined,
    synonyms: synonyms.length ? synonyms : [],
    satTraps: undefined,
    difficultyTier: "Medium",
    quizQuestion: placeholderQuiz(word, definition),
  };
}

function loadNotes(db: Database): { flds: string; tags: string; mid: number }[] {
  const rows: { flds: string; tags: string; mid: number }[] = [];
  const stmt = db.prepare("SELECT flds, tags, mid FROM notes");
  while (stmt.step()) {
    const row = stmt.getAsObject() as { flds: string; tags: string; mid: number };
    rows.push(row);
  }
  stmt.free();
  return rows;
}

function loadModels(db: Database): Record<string, AnkiModel> {
  const stmt = db.prepare("SELECT models FROM col LIMIT 1");
  if (!stmt.step()) {
    stmt.free();
    return {};
  }
  const row = stmt.getAsObject() as { models: string };
  stmt.free();
  try {
    return JSON.parse(row.models) as Record<string, AnkiModel>;
  } catch {
    return {};
  }
}

function loadDeckName(db: Database): string {
  const stmt = db.prepare("SELECT decks FROM col LIMIT 1");
  if (!stmt.step()) {
    stmt.free();
    return "Imported Anki deck";
  }
  const row = stmt.getAsObject() as { decks: string };
  stmt.free();
  return readDeckName(row.decks);
}

/** Parse an Anki `.apkg` or `.colpkg` file into vocab preview items. */
export async function parseApkgFile(file: File): Promise<ApkgParseResult> {
  if (file.size > 80 * 1024 * 1024) {
    throw new Error("Deck file is too large (max 80 MB).");
  }

  const buf = new Uint8Array(await file.arrayBuffer());
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(buf) as Record<string, Uint8Array>;
  } catch {
    throw new Error("Could not unzip file — use a standard .apkg exported from Anki.");
  }

  const { name: collectionName, data: collectionData } = findCollectionDb(files);
  if (collectionName.endsWith("b")) {
    throw new Error(
      "This deck uses Anki's newer compressed format (.anki21b). Re-export with " +
        '"Support older Anki versions (legacy)" checked in Anki export settings.',
    );
  }

  const SQL = await getSql();
  const db = new SQL.Database(collectionData);

  try {
    const models = loadModels(db);
    const deckName = loadDeckName(db);
    const notes = loadNotes(db);
    const warnings: string[] = [];
    const items: GeneratedVocabItem[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const note of notes) {
      const model = models[String(note.mid)] ?? {};
      const item = mapAnkiNoteToVocabItem({
        flds: note.flds,
        tags: note.tags ?? "",
        model,
      });
      if (!item) {
        skipped += 1;
        continue;
      }
      const key = item.word.trim().toLowerCase();
      if (seen.has(key)) {
        skipped += 1;
        continue;
      }
      seen.add(key);
      items.push(item);
    }

    if (items.length === 0) {
      throw new Error("No importable notes found. Basic Front/Back decks work best.");
    }

    if (skipped > 0) {
      warnings.push(`${skipped} duplicate or empty note${skipped === 1 ? "" : "s"} skipped.`);
    }

    return {
      deckName,
      items,
      warnings,
      skipped,
      noteCount: notes.length,
    };
  } finally {
    db.close();
  }
}
