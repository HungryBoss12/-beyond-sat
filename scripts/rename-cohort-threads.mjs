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

await client.connect();
const updated = await client.query(
  `update public.chat_threads t
      set title = c.name || ' · Class'
     from public.classes c
    where t.class_id = c.id
      and t.kind = 'class_group'
      and t.title ilike '%cohort%'`,
);
console.log("THREADS_RENAMED", updated.rowCount);
const { rows } = await client.query(
  "select id, name, description from public.classes order by name",
);
console.log(JSON.stringify(rows, null, 2));
await client.end();
