import fs from "fs";
import pg from "pg";

const env = Object.fromEntries(
  fs
    .readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    }),
);

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
const { rows } = await client.query("select count(*)::int as n from public.classes");
if (rows[0].n === 0) {
  await client.query(
    "insert into public.classes (name, description) values ($1, $2)",
    ["Group A", "Default student group"],
  );
  console.log("SEEDED_CLASS");
} else {
  console.log("CLASSES_EXIST", rows[0].n);
}
await client.end();
