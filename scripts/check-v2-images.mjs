/** Verify v2 figure attachments. Run: node scripts/check-v2-images.mjs */
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
         q.prompt like '%FIGURE NEEDED%' as figure_marker
  from public.tests t
  join public.test_questions tq on tq.test_id = t.id
  join public.questions q on q.id = tq.question_id
  where t.title like 'DSAT March 2024 v2%'
  order by t.title, tq.position
`);

const withImages = rows.filter((r) => r.has_image);
const markers = rows.filter((r) => r.figure_marker);
console.log(`Questions: ${rows.length}, with images: ${withImages.length}, figure markers left: ${markers.length}`);
for (const r of withImages) {
  console.log(`  ${r.title} Q${r.position}`);
}
if (markers.length) {
  console.log("Still marked:");
  for (const r of markers) console.log(`  ${r.title} Q${r.position}`);
}
await client.end();
