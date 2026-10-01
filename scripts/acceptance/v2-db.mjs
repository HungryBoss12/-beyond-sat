#!/usr/bin/env node
// Runs scripts/acceptance/v2-db.sql against the linked Supabase project.
// The SQL rolls back every write; this only prints the results and sets the exit code.
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const sqlFile = join(dirname(fileURLToPath(import.meta.url)), "v2-db.sql");
const run = spawnSync("npx", ["supabase", "db", "query", "--linked", "-f", sqlFile], {
  encoding: "utf8",
  shell: process.platform === "win32",
});

const out = `${run.stdout ?? ""}${run.stderr ?? ""}`;
const start = out.indexOf("{");
const end = out.lastIndexOf("}");
let rows;
try {
  rows = JSON.parse(out.slice(start, end + 1)).rows;
} catch {
  console.error(out);
  process.exit(2);
}

let failed = 0;
for (const row of rows) {
  if (!row.ok) failed += 1;
  console.log(`${row.ok ? "PASS" : "FAIL"}  ${row.check_name}  (${row.detail})`);
}
console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exit(failed ? 1 : 0);
