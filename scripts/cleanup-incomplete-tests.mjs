/**
 * Delete incomplete stub practice papers.
 * Thresholds: math module < 20Q, R&W < 25Q, or missing partner module.
 * Also force-deletes known stub title bases from screenshots.
 *
 * Run: node scripts/cleanup-incomplete-tests.mjs
 * Dry run: node scripts/cleanup-incomplete-tests.mjs --dry-run
 */
import fs from "fs";
import pg from "pg";

const DRY = process.argv.includes("--dry-run");

const FORCE_DELETE_BASES = [
  "dec 2025 us b",
  "math practice set (fix existing)",
  "june 2025 math v2",
  "sept 2025",
];

function loadEnv() {
  const path = ".dev.vars";
  if (!fs.existsSync(path)) {
    throw new Error("Missing .dev.vars (need SUPABASE_DB_PASSWORD)");
  }
  return Object.fromEntries(
    fs
      .readFileSync(path, "utf8")
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

function stripModuleSuffix(title) {
  return title
    .replace(/\s*[·\-–—]\s*(?:mod(?:ule)?\.?\s*)?[12]\s*$/i, "")
    .replace(/\s*\(\s*mod(?:ule)?\.?\s*[12]\s*\)\s*$/i, "")
    .replace(/\s+mod(?:ule)?\.?\s*[12]\s*$/i, "")
    .replace(/\s+m[12]\s*$/i, "")
    .trim();
}

function paperKey(title, section) {
  const base = stripModuleSuffix(title).toLowerCase().replace(/\s+/g, " ").trim();
  return `${section}:${base}`;
}

function minCount(section) {
  return section === "math" ? 20 : 25;
}

const env = loadEnv();
if (!env.SUPABASE_DB_PASSWORD) {
  throw new Error("SUPABASE_DB_PASSWORD missing from .dev.vars");
}

const client = new pg.Client({
  connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
  ssl: { rejectUnauthorized: false },
});
await client.connect();

const { rows: tests } = await client.query(`
  SELECT t.id, t.title, t.section, t.module,
    COALESCE((
      SELECT count(*)::int FROM test_questions tq WHERE tq.test_id = t.id
    ), 0) AS q_count
  FROM tests t
  ORDER BY t.title, t.module
`);

const groups = new Map();
for (const t of tests) {
  const key = paperKey(t.title, t.section);
  let g = groups.get(key);
  if (!g) {
    g = {
      key,
      base: stripModuleSuffix(t.title),
      section: t.section,
      mods: [],
    };
    groups.set(key, g);
  }
  g.mods.push(t);
}

const toDelete = new Set();
const reasons = [];

for (const g of groups.values()) {
  const baseNorm = g.base.toLowerCase().replace(/\s+/g, " ").trim();
  const force = FORCE_DELETE_BASES.some(
    (b) => baseNorm === b || baseNorm.includes(b) || b.includes(baseNorm),
  );

  const mod1 = g.mods.filter((m) => Number(m.module) === 1);
  const mod2 = g.mods.filter((m) => Number(m.module) === 2);
  const missingPartner = mod1.length === 0 || mod2.length === 0;
  const threshold = minCount(g.section);
  const underfilled = g.mods.some((m) => m.q_count < threshold);

  if (force || missingPartner || underfilled) {
    // Keep Dec 2024 C Math M1 at 21Q (known PDF gap) unless force-listed
    const isDec2024CMath =
      /december 2024 c/i.test(g.base) &&
      g.section === "math" &&
      !missingPartner &&
      g.mods.every((m) => m.q_count >= 20);

    if (isDec2024CMath && !force) {
      reasons.push({ paper: g.base, section: g.section, action: "keep", detail: "Dec 2024 C math near-full" });
      continue;
    }

    for (const m of g.mods) toDelete.add(m.id);
    reasons.push({
      paper: g.base,
      section: g.section,
      action: "delete",
      detail: force
        ? "force title match"
        : missingPartner
          ? `missing module (${mod1.length} M1 / ${mod2.length} M2)`
          : `underfilled (<${threshold}Q): ${g.mods.map((m) => `M${m.module}=${m.q_count}`).join(", ")}`,
      ids: g.mods.map((m) => m.id),
      counts: g.mods.map((m) => `M${m.module}=${m.q_count}`).join(", "),
    });
  } else {
    reasons.push({
      paper: g.base,
      section: g.section,
      action: "keep",
      detail: g.mods.map((m) => `M${m.module}=${m.q_count}`).join(", "),
    });
  }
}

const deletes = reasons.filter((r) => r.action === "delete");
const keeps = reasons.filter((r) => r.action === "keep");

console.log(`Papers to delete: ${deletes.length}`);
for (const r of deletes) {
  console.log(`  DELETE [${r.section}] ${r.paper} — ${r.detail} (${r.counts})`);
}
console.log(`Papers to keep: ${keeps.length}`);
for (const r of keeps) {
  console.log(`  KEEP [${r.section}] ${r.paper} — ${r.detail}`);
}

if (DRY) {
  console.log(`\nDry run — would delete ${toDelete.size} test row(s).`);
  await client.end();
  process.exit(0);
}

if (toDelete.size === 0) {
  console.log("\nNothing to delete.");
  await client.end();
  process.exit(0);
}

const ids = [...toDelete];
await client.query("BEGIN");
try {
  await client.query(`DELETE FROM test_questions WHERE test_id = ANY($1::uuid[])`, [ids]);
  const { rowCount } = await client.query(`DELETE FROM tests WHERE id = ANY($1::uuid[])`, [ids]);
  await client.query("COMMIT");
  console.log(`\nDeleted ${rowCount} test(s) and their question links.`);
} catch (e) {
  await client.query("ROLLBACK");
  console.error("Cleanup failed:", e);
  await client.end();
  process.exit(1);
}

await client.end();
