import { unzipSync } from "fflate";
import { buildDeckTreeFromAnki, deckPathFromAnkiName } from "./deck-tree";
import { decompressAnki21b } from "./anki-zstd";
import {
  firstLine,
  guessPartOfSpeech,
  parseSynonymsField,
  stripAnkiHtml,
} from "./anki-html";
import type { AnkiDeckNode, GeneratedVocabItem } from "./types";

type SqlJs = typeof import("sql.js");
type Database = InstanceType<SqlJs["Database"]>;

export type ApkgParseResult = {
  deckName: string;
  deckTree: AnkiDeckNode[];
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

const ANKI_STUB_RE = /please update to the latest anki version/i;
const COLLECTION_PRIORITY = ["collection.anki21", "collection.anki21b", "collection.anki2"];

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

function findCollectionDb(files: Record<string, Uint8Array>): { name: string; data: Uint8Array } {
  for (const name of COLLECTION_PRIORITY) {
    if (files[name]) return { name, data: files[name] };
  }
  const match = Object.keys(files).find((k) => /collection\.anki/i.test(k));
  if (match) return { name: match, data: files[match] };
  throw new Error("No Anki collection database found in this file. Is it a valid .apkg or .colpkg?");
}

async function openCollectionDb(
  SQL: SqlJs,
  collectionName: string,
  collectionData: Uint8Array,
): Promise<Database> {
  if (collectionName.endsWith("b")) {
    const decompressed = await decompressAnki21b(collectionData);
    return new SQL.Database(decompressed);
  }
  return new SQL.Database(collectionData);
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

export function isAnkiStubNote(word: string, definition: string): boolean {
  return ANKI_STUB_RE.test(word) || ANKI_STUB_RE.test(definition);
}

export function mapAnkiNoteToVocabItem(input: {
  flds: string;
  tags: string;
  model: AnkiModel;
  ankiDeckPath?: string;
}): GeneratedVocabItem | null {
  const parts = input.flds.split("\u001f");
  if (parts.every((p) => !p.trim())) return null;

  const modelName = (input.model.name ?? "").toLowerCase();
  const wordIdx = fieldIndex(input.model, "Word", "Front", "Term", "Question");
  const defIdx = fieldIndex(input.model, "Definition", "Back", "Meaning", "Answer");
  const exampleIdx = fieldIndex(input.model, "Example", "Sentence", "Extra", "Context", "Note");
  const antonymIdx = fieldIndex(input.model, "Antonym");
  const setIdx = fieldIndex(input.model, "Set");

  const wordFieldRaw = stripAnkiHtml(parts[wordIdx >= 0 ? wordIdx : 0] ?? "");
  const defFieldRaw = stripAnkiHtml(
    parts[defIdx >= 0 ? defIdx : 1] ?? parts[wordIdx >= 0 ? wordIdx + 1 : 1] ?? parts[0] ?? "",
  );
  const exampleRaw =
    exampleIdx >= 0 ? stripAnkiHtml(parts[exampleIdx] ?? "") : stripAnkiHtml(parts[2] ?? "");
  const antonymRaw = antonymIdx >= 0 ? stripAnkiHtml(parts[antonymIdx] ?? "") : "";
  const setRaw = setIdx >= 0 ? stripAnkiHtml(parts[setIdx] ?? "") : "";

  let word = firstLine(wordFieldRaw).slice(0, 120);
  let definition = defFieldRaw || wordFieldRaw;

  const reversedModel =
    modelName.includes("definition→word") ||
    modelName.includes("definition->word") ||
    (wordFieldRaw.length > defFieldRaw.length &&
      defFieldRaw.length > 0 &&
      defFieldRaw.length <= 48 &&
      !defFieldRaw.includes(","));

  if (reversedModel && defFieldRaw) {
    word = firstLine(defFieldRaw).slice(0, 120);
    definition = wordFieldRaw;
  }

  if (!word || !definition) return null;
  if (isAnkiStubNote(word, definition)) return null;

  const synonyms = parseSynonymsField(exampleRaw);
  const exampleSentence =
    exampleRaw.length > 20 && exampleRaw.length < 800 ? exampleRaw : undefined;
  const passage =
    exampleSentence ??
    `In academic writing, the word "${word}" often appears when authors ${definition.slice(0, 80).toLowerCase()}…`;

  return {
    word,
    partOfSpeech: guessPartOfSpeech(input.tags, definition),
    definition,
    dSatPassage: passage,
    rootsEtymology: undefined,
    synonyms: synonyms.length ? synonyms : [],
    satTraps: undefined,
    difficultyTier: "Medium",
    exampleSentence,
    antonym: antonymRaw || undefined,
    setLabel: setRaw ? `Set ${setRaw}` : undefined,
    ankiDeckPath: input.ankiDeckPath,
    quizQuestion: placeholderQuiz(word, definition),
  };
}

function loadNotes(db: Database): { id: number; flds: string; tags: string; mid: number }[] {
  const rows: { id: number; flds: string; tags: string; mid: number }[] = [];
  const stmt = db.prepare("SELECT id, flds, tags, mid FROM notes");
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; flds: string; tags: string; mid: number };
    rows.push(row);
  }
  stmt.free();
  return rows;
}

function loadNoteDeckMap(db: Database): Map<number, string> {
  const deckNames = new Map<number, string>();
  const deckStmt = db.prepare("SELECT id, name FROM decks");
  while (deckStmt.step()) {
    const row = deckStmt.getAsObject() as { id: number; name: string };
    deckNames.set(row.id, row.name);
  }
  deckStmt.free();

  const map = new Map<number, string>();
  const cardStmt = db.prepare("SELECT nid, did FROM cards");
  while (cardStmt.step()) {
    const row = cardStmt.getAsObject() as { nid: number; did: number };
    if (map.has(row.nid)) continue;
    const deckName = deckNames.get(row.did);
    if (deckName) {
      map.set(row.nid, deckPathFromAnkiName(deckName));
    }
  }
  cardStmt.free();
  return map;
}

function loadAnkiDecks(db: Database): { id: number; name: string }[] {
  const rows: { id: number; name: string }[] = [];
  const stmt = db.prepare("SELECT id, name FROM decks");
  while (stmt.step()) {
    const row = stmt.getAsObject() as { id: number; name: string };
    rows.push(row);
  }
  stmt.free();
  return rows;
}

function loadModelsLegacy(db: Database): Record<string, AnkiModel> {
  const stmt = db.prepare("SELECT models FROM col LIMIT 1");
  if (!stmt.step()) {
    stmt.free();
    return {};
  }
  const row = stmt.getAsObject() as { models: string };
  stmt.free();
  if (!row.models?.trim()) return {};
  try {
    return JSON.parse(row.models) as Record<string, AnkiModel>;
  } catch {
    return {};
  }
}

function loadModelsV18(db: Database): Record<string, AnkiModel> {
  const models: Record<string, AnkiModel> = {};
  try {
    const stmt = db.prepare(
      "SELECT nt.id, nt.name, f.ord, f.name AS field_name FROM notetypes nt JOIN fields f ON f.ntid = nt.id ORDER BY nt.id, f.ord",
    );
    while (stmt.step()) {
      const row = stmt.getAsObject() as {
        id: number;
        name: string;
        ord: number;
        field_name: string;
      };
      const key = String(row.id);
      if (!models[key]) {
        models[key] = { name: row.name, flds: [] };
      }
      models[key].flds!.push({ name: row.field_name });
    }
    stmt.free();
  } catch {
    /* schema v18 optional */
  }
  return models;
}

function loadModels(db: Database): Record<string, AnkiModel> {
  const legacy = loadModelsLegacy(db);
  if (Object.keys(legacy).length > 0) return legacy;
  return loadModelsV18(db);
}

function loadDeckName(db: Database): string {
  try {
    const stmt = db.prepare("SELECT name FROM decks WHERE id > 0 ORDER BY id LIMIT 5");
    const names: string[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as { name: string };
      const label = row.name?.split("\u001f").pop()?.trim();
      if (label) names.push(label);
    }
    stmt.free();
    if (names.length === 0) return "Imported Anki deck";
    if (names.length === 1) return names[0];
    return names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : "");
  } catch {
    /* legacy */
  }

  const stmt = db.prepare("SELECT decks FROM col LIMIT 1");
  if (!stmt.step()) {
    stmt.free();
    return "Imported Anki deck";
  }
  const row = stmt.getAsObject() as { decks: string };
  stmt.free();
  return readDeckName(row.decks);
}

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

  const SQL = await getSql();
  let db: Database;
  try {
    db = await openCollectionDb(SQL, collectionName, collectionData);
  } catch {
    throw new Error(
      "This deck uses Anki's modern compressed format but could not be read. " +
        "Try re-exporting with \"Support older Anki versions (legacy)\" checked, or update the site.",
    );
  }

  try {
    const models = loadModels(db);
    const deckName = loadDeckName(db);
    const deckTree = buildDeckTreeFromAnki(loadAnkiDecks(db));
    const noteDeckMap = loadNoteDeckMap(db);
    const notes = loadNotes(db);
    const warnings: string[] = [];
    const items: GeneratedVocabItem[] = [];
    const seen = new Set<string>();
    let skipped = 0;

    for (const note of notes) {
      const model = models[String(note.mid)] ?? {};
      const ankiDeckPath = noteDeckMap.get(note.id);
      const item = mapAnkiNoteToVocabItem({
        flds: note.flds,
        tags: note.tags ?? "",
        model,
        ankiDeckPath,
      });
      if (!item) {
        skipped += 1;
        continue;
      }
      const key = `${item.ankiDeckPath ?? ""}:${item.word.trim().toLowerCase()}`;
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
      warnings.push(`${skipped} duplicate, empty, or placeholder note${skipped === 1 ? "" : "s"} skipped.`);
    }

    return {
      deckName,
      deckTree,
      items,
      warnings,
      skipped,
      noteCount: notes.length,
    };
  } finally {
    db.close();
  }
}
