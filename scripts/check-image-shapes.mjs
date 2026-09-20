/** One-off check: image URL shapes after normalization. */
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
const r = await c.query(
  `select case
      when q.image_url is null then 'null'
      when q.image_url like 'https://%supabase.co/storage%' then 'signed-storage-url'
      when q.image_url like 'http%' then 'other-http'
      else 'path'
    end as shape,
    t.title,
    count(*)::int as n
  from questions q
  join test_questions tq on tq.question_id = q.id
  join tests t on t.id = tq.test_id
  where t.title ilike '%December 2024 C%' or t.title ilike 'DSAT May 2025%' or t.title ilike 'May 2025 INT%'
  group by 1, 2
  order by 2, 1`,
);
for (const row of r.rows) console.log(`${row.title} | ${row.shape} | ${row.n}`);
await c.end();
