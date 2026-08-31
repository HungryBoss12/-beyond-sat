/**
 * Parse Def-Word.colpkg → seed JSON with deck tree + subdeck cards.
 * Usage: node scripts/parse-def-word-colpkg.mjs
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { unzipSync } from "fflate";
import { decompress } from "fzstd";
import initSqlJs from "sql.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const source = join(root, "public/fixtures/vocab/def-word.colpkg");
const outJson = join(root, "supabase/seed-data/def-word-tree.json");

const SQL = await initSqlJs({
  locateFile: (file) => join(root, "node_modules/sql.js/dist", file),
});

const buf = readFileSync(source);
const files = unzipSync(new Uint8Array(buf));
const raw = files["collection.anki21b"];
const collectionData = decompress(new Uint8Array(raw), 50 * 1024 * 1024);
const db = new SQL.Database(collectionData);

const DECK_SEP = "\u001f";
const STUB = /please update to the latest anki version/i;

function stripHtml(raw) {
  return raw
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function firstLine(text) {
  return (
    text
      .split(/\n+/)
      .map((s) => s.trim())
      .find(Boolean) ?? text.trim()
  );
}

function loadModels() {
  const models = {};
  const fstmt = db.prepare(
    "SELECT nt.id, nt.name, f.ord, f.name AS field_name FROM notetypes nt JOIN fields f ON f.ntid = nt.id ORDER BY nt.id, f.ord",
  );
  while (fstmt.step()) {
    const row = fstmt.getAsObject();
    const key = String(row.id);
    if (!models[key]) models[key] = { name: row.name, flds: [] };
    models[key].flds.push({ name: row.field_name });
  }
  fstmt.free();
  return models;
}

function fieldIndex(model, ...names) {
  const flds = model.flds ?? [];
  const lower = names.map((n) => n.toLowerCase());
  return flds.findIndex((f) => lower.includes((f.name ?? "").toLowerCase()));
}

function buildDeckTree(rows) {
  const nodes = new Map();
  let order = 0;
  const ensure = (path, title, parentPath, isFolder) => {
    if (nodes.has(path)) return;
    nodes.set(path, { path, title, parentPath, sortOrder: order++, isFolder });
  };

  for (const row of rows) {
    if (row.id <= 0) continue;
    const segments = row.name.split(DECK_SEP).filter(Boolean);
    let parentPath = null;
    for (let i = 0; i < segments.length; i++) {
      const path = segments.slice(0, i + 1).join("::");
      ensure(path, segments[i], parentPath, i < segments.length - 1);
      parentPath = path;
    }
  }

  const leaves = [...nodes.values()].filter((n) => !n.isFolder);
  const groups = new Map();
  for (const leaf of leaves) {
    if (leaf.path.includes("::")) continue;
    const prefix = leaf.title.split(/\s+/)[0];
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix).push(leaf.path);
  }
  for (const [prefix, paths] of groups) {
    if (paths.length < 2) continue;
    const folderPath = `__group__::${prefix}`;
    ensure(folderPath, prefix, null, true);
    for (const p of paths) {
      nodes.get(p).parentPath = folderPath;
    }
  }

  return [...nodes.values()].sort((a, b) => a.sortOrder - b.sortOrder);
}

const deckRows = [];
const dstmt = db.prepare("SELECT id, name FROM decks");
while (dstmt.step()) deckRows.push(dstmt.getAsObject());
dstmt.free();

const deckTree = buildDeckTree(deckRows);

const deckNames = new Map(deckRows.map((r) => [r.id, r.name]));
const noteDeck = new Map();
const cstmt = db.prepare("SELECT nid, did FROM cards");
while (cstmt.step()) {
  const { nid, did } = cstmt.getAsObject();
  if (noteDeck.has(nid)) continue;
  const name = deckNames.get(did);
  if (name) {
    noteDeck.set(nid, name.split(DECK_SEP).filter(Boolean).join("::"));
  }
}
cstmt.free();

const models = loadModels();
const items = [];
const seen = new Set();

const nstmt = db.prepare("SELECT id, flds, tags, mid FROM notes");
while (nstmt.step()) {
  const note = nstmt.getAsObject();
  const parts = note.flds.split("\u001f");
  const model = models[String(note.mid)] ?? { flds: [{ name: "Word" }, { name: "Definition" }] };

  const wordIdx = fieldIndex(model, "Word", "Front");
  const defIdx = fieldIndex(model, "Definition", "Back");
  const exIdx = fieldIndex(model, "Example", "Sentence");
  const antIdx = fieldIndex(model, "Antonym");
  const setIdx = fieldIndex(model, "Set");

  const wordFieldRaw = stripHtml(parts[wordIdx >= 0 ? wordIdx : 0] ?? "");
  const defFieldRaw = stripHtml(parts[defIdx >= 0 ? defIdx : 1] ?? "");
  const exampleRaw = exIdx >= 0 ? stripHtml(parts[exIdx] ?? "") : stripHtml(parts[2] ?? "");
  const antonymRaw = antIdx >= 0 ? stripHtml(parts[antIdx] ?? "") : "";
  const setRaw = setIdx >= 0 ? stripHtml(parts[setIdx] ?? "") : "";

  let word = firstLine(wordFieldRaw).slice(0, 120);
  let definition = defFieldRaw || wordFieldRaw;
  if (
    wordFieldRaw.length > defFieldRaw.length &&
    defFieldRaw.length > 0 &&
    defFieldRaw.length <= 48 &&
    !defFieldRaw.includes(",")
  ) {
    word = firstLine(defFieldRaw).slice(0, 120);
    definition = wordFieldRaw;
  }
  if (!word || !definition || STUB.test(word) || STUB.test(definition)) continue;

  const deckPath = noteDeck.get(note.id) ?? "Imported";
  const key = `${deckPath}:${word.toLowerCase()}`;
  if (seen.has(key)) continue;
  seen.add(key);

  items.push({
    word,
    partOfSpeech: "noun",
    definition,
    dsatPassage:
      exampleRaw.length > 40 && exampleRaw.length < 800
        ? exampleRaw
        : `In academic writing, the word "${word}" often appears when authors ${definition.slice(0, 80).toLowerCase()}…`,
    exampleSentence: exampleRaw.length > 20 ? exampleRaw : null,
    antonym: antonymRaw || null,
    setLabel: setRaw ? `Set ${setRaw}` : null,
    ankiDeckPath: deckPath,
    synonyms: [],
    difficultyTier: "Medium",
  });
}
nstmt.free();
db.close();

mkdirSync(dirname(outJson), { recursive: true });
writeFileSync(outJson, JSON.stringify({ deckTree, items }, null, 2));
console.log(`Decks: ${deckTree.length}, Cards: ${items.length}`);
console.log(`Wrote ${outJson}`);
