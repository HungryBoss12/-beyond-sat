/** Apply the youtube_rec_cache section migration. Run: node scripts/apply-video-section-migration.mjs */
import fs from "fs";
import pg from "pg";

function loadDevVars() {
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

const env = loadDevVars();
const projectRef = env.SUPABASE_PROJECT_ID || "qlzvngegsemrzmyxwykl";
const sql = fs.readFileSync(
  "supabase/migrations/20260920000001_youtube_rec_cache_section.sql",
  "utf8",
);

const client = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${projectRef}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();
try {
  await client.query("BEGIN");
  await client.query(sql);
  await client.query("COMMIT");
  console.log("Migration applied: youtube_rec_cache.section + composite PK");
} catch (e) {
  await client.query("ROLLBACK");
  console.error("Migration failed:", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
