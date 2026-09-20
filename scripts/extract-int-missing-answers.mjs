/**
 * INT papers answer transcription — copy the question images for the 19
 * missing-answer items so they can be read and the keys backfilled.
 * Outputs a checklist JSON: scripts/int-answers-todo.json
 * Run: node scripts/extract-int-missing-answers.mjs
 */
import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

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
const supabase = createClient(
  `https://qlzvngegsemrzmyxwykl.supabase.co`,
  env.SUPABASE_SERVICE_ROLE_KEY,
);
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
  `select t.title, tq.position, q.id, q.kind, q.image_url,
          coalesce(q.prompt, '') || ' ' || coalesce(q.question_text, '') as stem
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'May 2025 INT%' and t.published
     and ((q.kind = 'multiple_choice' and q.correct_choice_id is null)
       or (q.kind = 'grid_in' and coalesce(array_length(q.correct_grid_answers, 1), 0) = 0))
   order by t.title, tq.position`,
);

console.log(`extracting ${rows.length} images for missing-answer questions…`);
const todo = [];
fs.mkdirSync("scripts/int-missing-pages", { recursive: true });

for (const r of rows) {
  if (!r.image_url) {
    todo.push({ paper: r.title, position: r.position, questionId: r.id, note: "no image — needs manual lookup" });
    continue;
  }
  const path = r.image_url;
  const { data, error } = await supabase.storage.from("question-images").createSignedUrl(path, 300);
  if (error || !data?.signedUrl) {
    todo.push({ paper: r.title, position: r.position, questionId: r.id, note: `sign failed: ${error?.message}` });
    continue;
  }
  const res = await fetch(data.signedUrl);
  if (!res.ok) {
    todo.push({ paper: r.title, position: r.position, questionId: r.id, note: `fetch ${res.status}` });
    continue;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const safeName = `${r.title.replace(/[^\w]+/g, "_")}_Q${r.position}.png`;
  fs.writeFileSync(`scripts/int-missing-pages/${safeName}`, buf);
  todo.push({ paper: r.title, position: r.position, questionId: r.id, image: safeName, stem: r.stem.slice(0, 120) });
}

fs.writeFileSync("scripts/int-answers-todo.json", JSON.stringify(todo, null, 1));
console.log(`wrote scripts/int-answers-todo.json (${todo.length} items)`);
await c.end();
process.exit(0);
