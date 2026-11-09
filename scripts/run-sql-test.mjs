// Runs SQL files against the linked project as one statement batch, which always rolls back.
// Usage: node scripts/run-sql-test.mjs [migration.sql ...] test.sql
// Migrations listed before the test run in the same implicit transaction, so a fix can be
// proven before it ships. Tests report by raising 'RESULT ...'; FAIL marks a failure.
import fs from "fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".dev.vars", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      let v = l.slice(i + 1).trim();
      if (/^(".*"|'.*')$/.test(v)) v = v.slice(1, -1);
      else v = v.replace(/\s+#.*$/, "");
      return [l.slice(0, i).trim(), v];
    }),
);
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("Usage: node scripts/run-sql-test.mjs [migration.sql ...] test.sql");
  process.exit(2);
}
const ref = env.SUPABASE_PROJECT_ID || "qlzvngegsemrzmyxwykl";
const sql = files
  .map((file) =>
    fs
      .readFileSync(file, "utf8")
      .replace(/^\s*NOTIFY\s+pgrst[^;]*;\s*$/gim, "")
      .replace(/^\s*INSERT INTO supabase_migrations\.schema_migrations[\s\S]*?;\s*$/gim, ""),
  )
  .join("\n;\n");

const response = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: "POST",
  headers: {
    authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    "content-type": "application/json",
  },
  body: JSON.stringify({ query: sql }),
});
const text = await response.text();
const match = text.match(/RESULT([^"\\]*(?:\\.[^"\\]*)*)/);
if (response.ok || !match) {
  console.error(
    response.ok
      ? "No RESULT raised; the batch may have committed"
      : `ERROR ${response.status} ${text.slice(0, 600)}`,
  );
  process.exitCode = 1;
} else {
  const lines = match[1]
    .replace(/\\nCONTEXT:[\s\S]*$/, "")
    .split(" | ")
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines) console.log(line);
  process.exitCode = lines.some((line) => line.startsWith("FAIL")) ? 1 : 0;
}
