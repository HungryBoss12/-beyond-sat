import fs from "fs";
import pg from "pg";

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
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

const env = loadEnv();
const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const tests = await client.query(
  `select t.id, t.title, t.module, count(tq.question_id)::int as q
   from public.tests t
   left join public.test_questions tq on tq.test_id = t.id
   where t.title like 'DSAT March 2024%'
   group by t.id, t.title, t.module
   order by t.module`,
);
console.log(JSON.stringify(tests.rows, null, 2));
await client.end();
