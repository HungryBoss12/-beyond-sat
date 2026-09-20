/**
 * Find public-facing SELECT policies that still call private.has_role /
 * bs_is_* — these break for anon after EXECUTE was revoked.
 */
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
const c = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${env.SUPABASE_PROJECT_ID}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();
const { rows } = await c.query(`
  select c.relname as table_name, p.polname, p.polcmd,
         pg_get_expr(p.polqual, p.polrelid) as using_expr
  from pg_policy p
  join pg_class c on c.oid = p.polrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and p.polcmd in ('r', '*')
    and (
      pg_get_expr(p.polqual, p.polrelid) ilike '%has_role%'
      or pg_get_expr(p.polqual, p.polrelid) ilike '%bs_is_%'
    )
  order by 1, 2`);
console.log(`found ${rows.length} SELECT policies referencing role helpers:`);
for (const r of rows) {
  console.log(`\n${r.table_name} :: ${r.polname}`);
  console.log(`  ${r.using_expr}`);
}
await c.end();
