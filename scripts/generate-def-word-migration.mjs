/**
 * Generate re-seed migration from def-word-tree.json
 * Usage: node scripts/generate-def-word-migration.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const jsonPath = join(root, "supabase/seed-data/def-word-tree.json");
const outPath = join(root, "supabase/migrations/20260831000006_reseed_def_word_subdecks.sql");

const OLD_DECK = "00000000-0000-4000-8000-000000000002";

function sqlStr(value) {
  if (value == null) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function deckId(path) {
  const hash = createHash("sha256").update(path).digest("hex").slice(0, 32);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

const { deckTree, items } = JSON.parse(readFileSync(jsonPath, "utf8"));
const pathToId = new Map(deckTree.map((d) => [d.path, deckId(d.path)]));

const lines = [
  "-- Re-seed Def-Word as grouped Anki subdecks. Idempotent.",
  "",
  `-- Remove monolithic Def-Word deck cards`,
  `DELETE FROM public.vocab_cards WHERE deck_id = '${OLD_DECK}';`,
  `DELETE FROM public.vocab_decks WHERE id = '${OLD_DECK}';`,
  "",
];

const byPath = new Map(deckTree.map((d) => [d.path, d]));
const sortedDecks = [];
const inserted = new Set();

function insertDeck(deck) {
  if (inserted.has(deck.path)) return;
  if (deck.parentPath && byPath.has(deck.parentPath)) {
    insertDeck(byPath.get(deck.parentPath));
  }
  sortedDecks.push(deck);
  inserted.add(deck.path);
}

for (const deck of [...deckTree].sort((a, b) => a.sortOrder - b.sortOrder)) {
  insertDeck(deck);
}

for (const deck of sortedDecks) {
  const id = pathToId.get(deck.path);
  const parentId = deck.parentPath ? pathToId.get(deck.parentPath) : null;
  lines.push(
    `INSERT INTO public.vocab_decks (id, title, description, parent_id, sort_order, is_folder, path)`,
  );
  lines.push(
    `VALUES ('${id}', ${sqlStr(deck.title)}, ${sqlStr(`Imported from ${deck.path}`)}, ${parentId ? `'${parentId}'` : "NULL"}, ${deck.sortOrder}, ${deck.isFolder}, ${sqlStr(deck.path)})`,
  );
  lines.push(`ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, parent_id = EXCLUDED.parent_id, sort_order = EXCLUDED.sort_order, is_folder = EXCLUDED.is_folder, path = EXCLUDED.path;`);
  lines.push("");
}

for (const item of items) {
  const deckIdVal = pathToId.get(item.ankiDeckPath);
  if (!deckIdVal) continue;
  lines.push(
    `INSERT INTO public.vocab_cards (word, part_of_speech, definition, dsat_passage, example_sentence, antonym, set_label, synonyms, difficulty_tier, deck_id)`,
  );
  lines.push(
    `VALUES (${sqlStr(item.word)}, ${sqlStr(item.partOfSpeech)}, ${sqlStr(item.definition)}, ${sqlStr(item.dsatPassage)}, ${sqlStr(item.exampleSentence)}, ${sqlStr(item.antonym)}, ${sqlStr(item.setLabel)}, '{}'::text[], ${sqlStr(item.difficultyTier)}, '${deckIdVal}')`,
  );
  lines.push(`ON CONFLICT (word) DO UPDATE SET definition = EXCLUDED.definition, dsat_passage = EXCLUDED.dsat_passage, example_sentence = EXCLUDED.example_sentence, antonym = EXCLUDED.antonym, set_label = EXCLUDED.set_label, deck_id = EXCLUDED.deck_id;`);
  lines.push("");
}

writeFileSync(outPath, lines.join("\n"));
console.log(`Wrote ${sortedDecks.length} decks, ${items.length} cards to ${outPath}`);
