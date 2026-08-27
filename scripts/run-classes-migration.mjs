import fs from "fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [
        l.slice(0, i).trim(),
        l
          .slice(i + 1)
          .trim()
          .replace(/^"|"$/g, ""),
      ];
    }),
);

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

const sqlPath = process.argv[2] ?? "supabase/migrations/20260824000001_classes_chat_homework.sql";
await client.connect();
const sql = fs.readFileSync(sqlPath, "utf8");
try {
  await client.query(sql);
  console.log("MIGRATION_OK");
} catch (e) {
  console.error("MIGRATION_FAIL", e.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
