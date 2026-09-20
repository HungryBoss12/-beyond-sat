/**
 * Sweep imported papers for unicode math glyphs (𝑥, 𝑦, −, 𝜋 etc. produced by
 * PDF text extraction) and normalize to ASCII:
 *  - math italic/bold/etc. letters → plain letters (visually equivalent)
 *  - unicode minus (U+2212) → hyphen-minus
 * No auto $…$ wrapping (too error-prone); broken fraction layouts are patched
 * separately in fix scripts.
 *
 * Dry-run by default: node scripts/fix-unicode-glyphs.mjs          (shows plan)
 * Apply:             node scripts/fix-unicode-glyphs.mjs --apply
 */
import fs from "node:fs";
import pg from "pg";

const APPLY = process.argv.includes("--apply");
const PAPER_FILTERS = ["DSAT December 2024 C%", "DSAT May 2025%", "May 2025 INT%"];

function loadDevVars() {
  return Object.fromEntries(
    fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

// Range table: [start, end, offsetToBase] where offset maps cp → base char code.
const RANGES = [
  [0x1d400, 0x1d419, 65], // bold caps A-Z
  [0x1d41a, 0x1d433, 97], // bold small a-z
  [0x1d434, 0x1d44d, 65], // italic caps A-Z
  [0x1d44e, 0x1d467, 97], // italic small a-z (h is U+210E, handled below)
  [0x1d468, 0x1d481, 65], // bold italic caps
  [0x1d482, 0x1d49b, 97], // bold italic small
  [0x1d49c, 0x1d4b5, 65], // script caps (holes → leave, rare)
  [0x1d4b6, 0x1d4cf, 97], // script small
  [0x1d504, 0x1d51d, 65], // fraktur caps
  [0x1d51e, 0x1d537, 97], // fraktur small
  [0x1d538, 0x1d551, 65], // double-struck caps
  [0x1d552, 0x1d56b, 97], // double-struck small
  [0x1d5a0, 0x1d5b9, 65], // sans caps
  [0x1d5ba, 0x1d5d3, 97], // sans small
  [0x1d5d4, 0x1d5ed, 65], // sans bold caps
  [0x1d5ee, 0x1d607, 97], // sans bold small
  [0x1d608, 0x1d621, 65], // sans bold italic caps
  [0x1d622, 0x1d63b, 97], // sans bold italic small
  [0x1d670, 0x1d689, 65], // monospace caps
  [0x1d68a, 0x1d6a3, 97], // monospace small
  [0x1d7ce, 0x1d7d7, 48], // bold digits
  [0x1d7d8, 0x1d7e1, 48], // double-struck digits
  [0x1d7e2, 0x1d7eb, 48], // sans digits
  [0x1d7ec, 0x1d7f5, 48], // sans bold digits
  [0x1d7f6, 0x1d7ff, 48], // monospace digits
];

const GREEK_CAPS = "ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ";
const GREEK_SMALL = "αβγδεζηθικλμνξοπρςστυφχψω";

function mapChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp === 0x210e) return "h"; // planck constant = italic h
  if (cp === 0x2212) return "-";
  for (const [start, end, base] of RANGES) {
    if (cp >= start && cp <= end) return String.fromCharCode(base + (cp - start));
  }
  // Bold greek: caps 1D6A8–1D6C0, ∇ 1D6C1, smalls 1D6C2–1D6DA
  if (cp >= 0x1d6a8 && cp <= 0x1d6c0) return GREEK_CAPS[cp - 0x1d6a8] ?? ch;
  if (cp >= 0x1d6c2 && cp <= 0x1d6da) return GREEK_SMALL[cp - 0x1d6c2] ?? ch;
  // Italic greek: caps 1D6E2–1D6FA, smalls 1D6FC–1D714 (no nabla in italic)
  if (cp >= 0x1d6e2 && cp <= 0x1d6fa) return GREEK_CAPS[cp - 0x1d6e2] ?? ch;
  if (cp >= 0x1d6fc && cp <= 0x1d714) return GREEK_SMALL[cp - 0x1d6fc] ?? ch;
  return null;
}

function mapMathAlnum(text) {
  let out = "";
  let changed = false;
  for (const ch of text) {
    const mapped = mapChar(ch);
    if (mapped !== null) {
      changed = true;
      out += mapped;
    } else {
      out += ch;
    }
  }
  return { text: out, changed };
}

function normalize(text) {
  if (!text) return { text, changed: false };
  return mapMathAlnum(text);
}

const env = loadDevVars();
const client = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${env.SUPABASE_PROJECT_ID}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();

const { rows } = await client.query(
  `select q.id, t.title, tq.position, q.prompt, q.question_text, q.choices, q.correct_grid_answers
   from public.questions q
   join public.test_questions tq on tq.question_id = q.id
   join public.tests t on t.id = tq.test_id
   where (${PAPER_FILTERS.map((_, i) => `t.title ilike $${i + 1}`).join(" or ")})
     and (q.prompt ~ '[\\u1D400-\\u1D7FF]' or q.question_text ~ '[\\u1D400-\\u1D7FF]'
          or q.choices::text ~ '[\\u1D400-\\u1D7FF]' or q.prompt like '%−%' or q.question_text like '%−%'
          or q.choices::text like '%−%')`,
  PAPER_FILTERS,
);

console.log(`found ${rows.length} questions with unicode math glyphs (APPLY=${APPLY})`);

let fixed = 0;
for (const r of rows) {
  const p = normalize(r.prompt);
  const q = normalize(r.question_text);
  const origChoices = r.choices ?? [];
  const choices = origChoices.map((c) => {
    const { text, changed } = normalize(c?.text);
    return changed ? { ...c, text } : c;
  });
  const grid = (r.correct_grid_answers ?? []).map((a) => normalize(a).text);
  const anyChoiceChanged = choices.some((c, i) => c !== origChoices[i]);
  if (!p.changed && !q.changed && !anyChoiceChanged) continue;

  fixed++;
  const label = `${r.title} Q${r.position}`;
  const preview = (s) => (s ?? "").slice(0, 70).replace(/\n/g, " ");
  console.log(`\n${label}:`);
  if (p.changed) console.log(`  prompt:   ${preview(r.prompt)}\n         → ${preview(p.text)}`);
  if (q.changed) console.log(`  question: ${preview(r.question_text)}\n         → ${preview(q.text)}`);
  origChoices.forEach((c, i) => {
    if (choices[i] !== c) console.log(`  choice ${c?.id}: ${preview(c?.text)}\n         → ${preview(choices[i].text)}`);
  });
  if (!APPLY) continue;
  await client.query(
    `update public.questions set prompt=$1, question_text=$2, choices=$3::jsonb, correct_grid_answers=$4::text[], updated_at=now() where id=$5`,
    [p.text, q.text, JSON.stringify(choices), grid, r.id],
  );
}

console.log(`\n${fixed} questions ${APPLY ? "updated" : "would be updated"}.`);
if (!APPLY) console.log("Re-run with --apply to write changes.");
await client.end();
process.exit(0);
