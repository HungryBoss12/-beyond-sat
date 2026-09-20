/** Apply homepage_sections anon-read fix. */
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
const sql = fs.readFileSync(
  "supabase/migrations/20260920000002_homepage_sections_anon_read.sql",
  "utf8",
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
await c.query("BEGIN");
try {
  await c.query(sql);
  await c.query("COMMIT");
  console.log("Applied homepage_sections anon-read fix");
} catch (e) {
  await c.query("ROLLBACK");
  console.error(e.message);
  process.exitCode = 1;
}
await c.end();
