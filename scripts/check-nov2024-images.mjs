/** Verify Nov 2024 figure attachments. Run: node scripts/check-nov2024-images.mjs */
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
        let v = l.slice(i + 1).trim().replace(/\s+#.*$/, "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const env = loadEnv();
const client = new pg.Client({
  host: "db.qlzvngegsemrzmyxwykl.supabase.co",
  port: 5432,
  database: "postgres",
  user: "postgres",
  password: env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows } = await client.query(`
  select t.title, tq.position, q.image_url is not null as has_image,
         q.prompt like '%FIGURE NEEDED%' as figure_marker,
         q.correct_choice_id, q.correct_grid_answers
  from public.tests t
  join public.test_questions tq on tq.test_id = t.id
  join public.questions q on q.id = tq.question_id
  where t.title like 'DSAT November 2024%'
  order by t.title, tq.position
`);

const withImages = rows.filter((r) => r.has_image);
const noAnswer = rows.filter((r) => !r.correct_choice_id && !r.correct_grid_answers?.length);
console.log(`Questions: ${rows.length}, images: ${withImages.length}, missing answers: ${noAnswer.length}`);
await client.end();
