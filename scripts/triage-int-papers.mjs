/**
 * Triage INT papers: check answer keys against the exam PDFs' answer ranges.
 * May 2025 INT 2 / INT3 are missing answers for ~19 questions. If the source
 * PDFs (docx screenshots) contain answer keys we backfill; otherwise the papers
 * should be unpublished until answers are transcribed.
 * Read-only triage: node scripts/triage-int-papers.mjs
 * Unpublish broken:  node scripts/triage-int-papers.mjs --unpublish-broken
 */
import fs from "node:fs";
import pg from "pg";

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
const env = loadDevVars();
const c = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${env.SUPABASE_PROJECT_ID}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const { rows } = await c.query(
  `select t.id as test_id, t.title, t.section, t.module,
     count(*)::int as total,
     count(*) filter (where q.kind = 'multiple_choice' and q.correct_choice_id is null)::int as mc_missing,
     count(*) filter (where q.kind = 'grid_in' and coalesce(array_length(q.correct_grid_answers, 1), 0) = 0)::int as grid_missing
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'May 2025 INT%'
   group by t.id, t.title, t.section, t.module
   order by t.title`,
);

const unpublish = process.argv.includes("--unpublish-broken");
console.log("=== INT papers triage ===");
for (const r of rows) {
  const broken = r.mc_missing + r.grid_missing;
  console.log(
    `${r.title} (${r.section} M${r.module}): ${r.total} questions, missing answers: MC ${r.mc_missing}, grid ${r.grid_missing}` +
      (broken ? "  → BROKEN" : "  → ok"),
  );
  if (broken && unpublish) {
    await c.query(`update public.tests set published = false, updated_at = now() where id = $1`, [r.test_id]);
    console.log(`  → unpublished ${r.title}`);
  }
}

// Sample the missing ones for later transcription.
const { rows: sample } = await c.query(
  `select t.title, tq.position, q.kind, left(coalesce(q.question_text, q.prompt), 60) as stem
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'May 2025 INT%' and t.published
     and ((q.kind = 'multiple_choice' and q.correct_choice_id is null)
       or (q.kind = 'grid_in' and coalesce(array_length(q.correct_grid_answers, 1), 0) = 0))
   order by t.title, tq.position
   limit 25`,
);
console.log("\n=== Sample missing-answer questions (first 25) ===");
for (const s of sample) console.log(`${s.title} Q${s.position} (${s.kind}): ${s.stem}`);

await c.end();
process.exit(0);
