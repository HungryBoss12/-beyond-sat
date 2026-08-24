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
const { rowCount } = await client.query(
  `update public.classes
      set name = 'Group A',
          description = coalesce(nullif(description, ''), 'Default student group')
    where name ilike '%cohort%'`,
);
console.log("RENAMED", rowCount);
await client.end();
