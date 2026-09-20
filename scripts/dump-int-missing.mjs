/** Dump full stems + choices for the 19 INT missing-answer questions. */
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
  `select t.title, tq.position, q.kind, q.prompt, q.question_text, q.choices, q.image_url
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'May 2025 INT%' and t.published
     and ((q.kind = 'multiple_choice' and q.correct_choice_id is null)
       or (q.kind = 'grid_in' and coalesce(array_length(q.correct_grid_answers, 1), 0) = 0))
   order by t.title, tq.position`,
);

for (const r of rows) {
  console.log(`\n##### ${r.title} Q${r.position} (${r.kind}) img=${r.image_url ? "yes" : "NO"}`);
  if (r.prompt) console.log("PROMPT:", r.prompt);
  if (r.question_text) console.log("Q:", r.question_text);
  for (const ch of r.choices ?? []) console.log(`  ${ch?.id}) ${(ch?.text ?? "").slice(0, 100)}`);
}
await c.end();
