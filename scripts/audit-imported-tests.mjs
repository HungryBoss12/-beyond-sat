/**
 * Unified QA audit for imported papers: DSAT December 2024 C, DSAT May 2025,
 * May 2025 INT 2, May 2025 INT3.
 *
 * Checks per question:
 *  - answer presence (correct_choice_id / correct_grid_answers)
 *  - MC choice completeness (>=4 filled choices)
 *  - short/missing stems
 *  - leftover FIGURE NEEDED markers
 *  - image_url: signed URL (should be durable path) vs path; unreachable URL
 *  - non-ASCII math glyphs (unicode math italic letters that break KaTeX)
 *  - May 2025 compose-needed positions (M1 Q3/Q7/Q15, M2 Q1/Q4): image should exist
 *
 * Read-only. Run: node scripts/audit-imported-tests.mjs [--include-int]
 */
import fs from "node:fs";
import pg from "pg";

const COMPOSE_POSITIONS = [
  { module: 1, position: 3 },
  { module: 1, position: 7 },
  { module: 1, position: 15 },
  { module: 2, position: 1 },
  { module: 2, position: 4 },
];

// Source PDF gaps that are NOT import bugs.
const KNOWN_GAPS = [
  { paper: "DSAT December 2024 C", note: "Q7 missing from PDF in EBRW M1 and Math M1" },
  { paper: "DSAT December 2024 C", note: "Math M1 Q5 has no graph in source PDF" },
];

/** Unicode math italic/bold glyphs (U+1D400–U+1D7FF) commonly produced by OCR. */
const UNICODE_MATH_RE = /[\u{1D400}-\u{1D7FF}]/u;
const FIGURE_RE = /FIGURE NEEDED/i;

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

const includeInt = process.argv.includes("--include-int");
const PAPER_FILTERS = includeInt
  ? ["DSAT December 2024 C%", "DSAT May 2025%", "May 2025 INT%"]
  : ["DSAT December 2024 C%", "DSAT May 2025%"];

const env = loadDevVars();
const client = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${env.SUPABASE_PROJECT_ID}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});
await client.connect();

const { rows } = await client.query(
  `select t.id as test_id, t.title, t.section, t.module, t.source_month, t.source_year,
          tq.position, q.id as question_id, q.kind, q.prompt, q.question_text, q.choices,
          q.image_url, q.correct_choice_id, q.correct_grid_answers
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where (${PAPER_FILTERS.map((_, i) => `t.title ilike $${i + 1}`).join(" or ")})
   order by t.title, tq.position`,
  PAPER_FILTERS,
);

const { rows: testRows } = await client.query(
  `select id, title from public.tests
   where (${PAPER_FILTERS.map((_, i) => `title ilike $${i + 1}`).join(" or ")})
   order by title`,
  PAPER_FILTERS,
);

const issues = [];
const byTest = new Map();
for (const r of rows) {
  const list = byTest.get(r.title) ?? [];
  list.push(r);
  byTest.set(r.title, list);
}

function imageKind(url) {
  if (!url) return "none";
  if (/\/storage\/v1\/object\/(?:sign|public|authenticated)\//i.test(url)) return "signed-url";
  if (/^https?:\/\//i.test(url)) return "external-url";
  return "path";
}

for (const [title, list] of byTest) {
  for (const r of list) {
    const label = `${title} Q${r.position}`;
    const choices = Array.isArray(r.choices) ? r.choices : [];
    const filled = choices.filter((c) => (c?.text ?? "").trim()).length;

    if (r.kind === "multiple_choice") {
      if (filled < 4) issues.push(`${label}: incomplete choices (${filled}/4)`);
      if (!r.correct_choice_id) issues.push(`${label}: missing correct_choice_id`);
    } else if (r.kind === "grid_in") {
      if (!r.correct_grid_answers?.length) issues.push(`${label}: missing correct_grid_answers`);
    }

    const stem = `${r.prompt ?? ""}\n${r.question_text ?? ""}`;
    if (stem.trim().length < 15) issues.push(`${label}: short/missing stem`);

    if (FIGURE_RE.test(r.prompt ?? "")) issues.push(`${label}: FIGURE NEEDED marker still present`);

    const kind = imageKind(r.image_url);
    if (kind === "signed-url") issues.push(`${label}: image_url is a signed URL (should be durable path)`);
    if (UNICODE_MATH_RE.test(stem) || choices.some((c) => UNICODE_MATH_RE.test(c?.text ?? ""))) {
      issues.push(`${label}: unicode math glyphs (should be LaTeX)`);
    }

    // May 2025 compose-needed positions must have an image.
    if (/^DSAT May 2025/.test(title)) {
      const hit = COMPOSE_POSITIONS.find((p) => p.module === r.module && p.position === r.position);
      if (hit && kind === "none") issues.push(`${label}: compose-needed position has no image`);
    }
  }

  // Position gaps.
  const positions = list.map((r) => r.position).sort((a, b) => a - b);
  const max = Math.max(...positions);
  const missing = [];
  for (let i = 1; i <= max; i++) if (!positions.includes(i)) missing.push(i);
  if (missing.length) {
    const known = /December 2024 C/.test(title) && missing.length === 1 && missing[0] === 7;
    issues.push(`${title}: missing positions ${missing.join(", ")}${known ? " (known source gap)" : ""}`);
  }
}

// Image reachability (paths are signed on the fly; only http URLs need a HEAD check).
const httpImages = rows.filter((r) => imageKind(r.image_url) === "external-url" || imageKind(r.image_url) === "signed-url");
let badUrls = 0;
for (const r of httpImages.slice(0, 30)) {
  try {
    const res = await fetch(r.image_url, { method: "HEAD", signal: AbortSignal.timeout(10000) });
    if (!res.ok) {
      issues.push(`${r.title} Q${r.position}: image HTTP ${res.status}`);
      badUrls++;
    }
  } catch (e) {
    issues.push(`${r.title} Q${r.position}: image fetch failed (${e.message?.slice(0, 40)})`);
    badUrls++;
  }
}

// ---- Summary ----
console.log("=== Imported papers audit ===\n");
for (const t of testRows) {
  const list = byTest.get(t.title) ?? [];
  const withImage = list.filter((r) => r.image_url).length;
  const signed = list.filter((r) => imageKind(r.image_url) === "signed-url").length;
  console.log(`${t.title}: ${list.length} questions, ${withImage} with image (${signed} signed-url)`);
}

console.log(`\nIssues: ${issues.length}`);
for (const i of issues) console.log("  -", i);

if (!includeInt) {
  console.log("\n(INT papers excluded — rerun with --include-int to audit May 2025 INT 2 / INT3)");
}
console.log("\nKnown source gaps (not fixable):");
for (const g of KNOWN_GAPS) console.log(`  - ${g.paper}: ${g.note}`);

await client.end();
const unexpected = issues.filter((i) => !i.includes("(known source gap)")).length;
console.log(`\nAUDIT_${unexpected === 0 ? "CLEAN" : "ISSUES"} (${unexpected} unexpected)`);
process.exit(0);
