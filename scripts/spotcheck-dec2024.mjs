/** Deep content spot-check for Dec 2024 C import. Run: node scripts/spotcheck-dec2024.mjs */
import fs from "fs";
import pg from "pg";

const env = Object.fromEntries(
  fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/).filter((l) => l && !l.startsWith("#")).map((l) => {
    const i = l.indexOf("=");
    let v = l.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    return [l.slice(0, i).trim(), v];
  }),
);

const client = new pg.Client({
  host: "db.qlzvngegsemrzmyxwykl.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: tests } = await client.query(`
  select t.title, t.section, t.module, count(*)::int as n
  from tests t join test_questions tq on tq.test_id = t.id
  where t.title like 'DSAT December 2024 C%'
  group by t.title, t.section, t.module order by t.title
`);

const { rows } = await client.query(`
  select t.title, t.section, t.module, tq.position, q.kind,
         length(coalesce(q.question_text,'')) as stem_len,
         jsonb_array_length(coalesce(q.choices,'[]'::jsonb)) as choice_count,
         (select count(*) from jsonb_array_elements(coalesce(q.choices,'[]'::jsonb)) c where length(trim(c->>'text')) > 0) as filled_choices,
         q.image_url,
         q.correct_choice_id, q.correct_grid_answers
  from tests t join test_questions tq on tq.test_id = t.id join questions q on q.id = tq.question_id
  where t.title like 'DSAT December 2024 C%'
  order by t.title, tq.position
`);

const issues = [];
for (const r of rows) {
  if (r.stem_len < 15) issues.push(`${r.title} Q${r.position}: short stem (${r.stem_len} chars)`);
  if (r.kind === "multiple_choice" && r.filled_choices < 4)
    issues.push(`${r.title} Q${r.position}: ${r.filled_choices}/4 choices`);
  if (!r.correct_choice_id && !r.correct_grid_answers?.length)
    issues.push(`${r.title} Q${r.position}: no answer`);
}

console.log("=== Module counts ===");
for (const t of tests) console.log(`  ${t.title}: ${t.n} questions`);

console.log("\n=== Positions (gaps expected at Q7) ===");
for (const title of [...new Set(rows.map((r) => r.title))]) {
  const pos = rows.filter((r) => r.title === title).map((r) => r.position);
  const missing = [];
  for (let i = 1; i <= Math.max(...pos); i++) if (!pos.includes(i)) missing.push(i);
  if (missing.length) console.log(`  ${title}: missing positions ${missing.join(", ")}`);
}

console.log("\n=== Figures ===");
const figRows = rows.filter((r) => r.image_url);
console.log(`  ${figRows.length} questions with images`);
for (const r of figRows) {
  try {
    const res = await fetch(r.image_url, { method: "HEAD" });
    if (!res.ok) issues.push(`${r.title} Q${r.position}: image HTTP ${res.status}`);
  } catch (e) {
    issues.push(`${r.title} Q${r.position}: image fetch failed`);
  }
}

console.log(`\n=== Issues: ${issues.length} ===`);
for (const i of issues) console.log("  -", i);
if (!issues.length) console.log("  All spot-checks passed.");

await client.end();
