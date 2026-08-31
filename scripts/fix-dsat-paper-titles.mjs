/**
 * Rename DSAT March 2024 module rows to canonical paper titles so Mod 1 + Mod 2 group as one card.
 */
import fs from "fs";
import pg from "pg";

function moduleTitle(base, module) {
  return `${base} · Module ${module}`;
}

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

const TITLE_BASE = "DSAT March 2024";

const PAPERS = [
  { base: TITLE_BASE, section: "reading_writing" },
  { base: TITLE_BASE, section: "math" },
];

async function main() {
  const env = loadEnv();
  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  for (const p of PAPERS) {
    for (const module of [1, 2]) {
      const title = moduleTitle(p.base, module);
      const { rowCount } = await client.query(
        `update public.tests
         set title = $1
         where section = $2 and module = $3 and title like 'DSAT March 2024%'`,
        [title, p.section, module],
      );
      console.log(`${title}: updated ${rowCount} row(s)`);
    }
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
