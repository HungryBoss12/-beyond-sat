#!/usr/bin/env node
// =====================================================================
// BeyondSAT content rescue: OLD Supabase project -> NEW Supabase project.
//
// The old project's dashboard is unreachable (Lovable owns it), but its
// REST API is not: the publishable key plus an admin login satisfies every
// RLS policy on the content tables. This pulls that content out and pushes
// it into the new project.
//
//   node export-content.cjs export     # write content/*.json, touch nothing
//   node export-content.cjs import     # push content/*.json into NEW project
//   node export-content.cjs            # both, in one pass
//
// Export is read-only. Run it first and look at the JSON before importing.
//
// NOT COPIED, deliberately:
//   auth.users      - password hashes are not exposed by any API
//   profiles        - one row per user; the users do not exist any more
//   student_profiles- same
//   test_sessions   - references user ids that will not exist
//   attempts        - same
//   user_roles      - you grant admin yourself in FRESH_PROJECT_STEP2_ADMIN.sql
//
// Needs Node 18+ (uses global fetch). No dependencies.
// =====================================================================

const fs = require("fs");
const path = require("path");

// ----------------------------- CONFIG ---------------------------------
// OLD project: URL and publishable key are already in your .env (or in
// git history for wrangler.jsonc). The admin login is the account you used
// to sign into the app's admin panel.
const OLD = {
  url: "https://secadznjokojeswksmbx.supabase.co",
  key: "PASTE_OLD_PUBLISHABLE_KEY",
  email: "PASTE_OLD_ADMIN_EMAIL",
  password: "PASTE_OLD_ADMIN_PASSWORD",
};

// NEW project: from Project Settings -> API, plus the admin account you
// created by signing up and running FRESH_PROJECT_STEP2_ADMIN.sql.
const NEW = {
  url: "https://PASTE_NEW_REF.supabase.co",
  key: "PASTE_NEW_PUBLISHABLE_KEY",
  email: "PASTE_NEW_ADMIN_EMAIL",
  password: "PASTE_NEW_ADMIN_PASSWORD",
};
// -----------------------------------------------------------------------

const OUT_DIR = path.join(__dirname, "content-export");
const CHUNK = 400; // rows per insert request
const RPC_CONCURRENCY = 12; // parallel answer-key lookups

// Import order matters: a child row cannot land before its parent exists.
// `order` is the pagination sort key - it must be a real column, and tables
// with a composite primary key have no `id`.
const TABLES = [
  { name: "questions", order: "id" },
  { name: "tests", order: "id" },
  { name: "test_questions", order: "test_id" },
  { name: "daily_tests", order: "id" },
  { name: "daily_test_tests", order: "daily_test_id" },
  { name: "daily_test_questions", order: "daily_test_id" },
  { name: "mock_exams", order: "id" },
  { name: "mock_exam_sections", order: "id" },
  { name: "mock_exam_questions", order: "id" },
  { name: "news_articles", order: "id" },
  { name: "exam_dates", order: "id" },
  { name: "homepage_sections", order: "position", replaceAll: true },
  { name: "app_settings", order: "key" },
];

// Explicit column lists, copied from FRESH_PROJECT_SCHEMA.sql. `select=*`
// is not safe here: migration 20260721232119 revokes SELECT on the answer-key
// columns of `questions` from `authenticated`, so a `*` select 403s.
const COLUMNS = {
  questions:
    "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,created_by,created_at,updated_at,source_month,source_year,time_limit_seconds",
  tests:
    "id,title,section,module,difficulty,source_month,source_year,created_by,created_at,updated_at,time_limit_seconds",
  test_questions: "test_id,question_id,position",
  daily_tests: "id,date,title,created_by,created_at,updated_at",
  daily_test_tests: "daily_test_id,test_id,position",
  daily_test_questions: "daily_test_id,question_id,position",
  mock_exams:
    "id,title,description,rw_module1_time_seconds,rw_module2_time_seconds,math_module1_time_seconds,math_module2_time_seconds,rw_module1_threshold,math_module1_threshold,published,created_by,created_at,updated_at",
  mock_exam_sections: "id,mock_exam_id,module,section_index,section_name,test_id",
  mock_exam_questions: "id,mock_exam_id,question_id,section,module,variant,position",
  news_articles:
    "id,title,slug,excerpt,body,cover_image_url,published,published_at,author_id,created_at,updated_at",
  exam_dates: "id,exam_date,label,active,created_at,updated_at",
  homepage_sections: "id,kind,position,visible,data,created_at,updated_at",
  app_settings: "key,value,updated_at",
};

// Columns pointing at auth.users. Their users are gone, so the FK would
// fail on insert; all of them are nullable, so null is the correct value.
const USER_FK = {
  questions: "created_by",
  tests: "created_by",
  daily_tests: "created_by",
  mock_exams: "created_by",
  news_articles: "author_id",
};

// ------------------------------ http ----------------------------------
async function req(url, opts = {}) {
  const res = await fetch(url, opts);
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url.split("?")[0]}\n    ${body.slice(0, 400)}`);
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    throw new Error(`expected JSON, got: ${body.slice(0, 200)}`);
  }
}

async function login(p) {
  const out = await req(`${p.url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: p.key },
    body: JSON.stringify({ email: p.email, password: p.password }),
  });
  if (!out?.access_token) throw new Error("login returned no access_token");
  return out.access_token;
}

const authHeaders = (p, token) => ({ apikey: p.key, Authorization: `Bearer ${token}` });

async function selectAll(p, token, table, columns, order) {
  const rows = [];
  const step = 1000;
  for (let offset = 0; ; offset += step) {
    const qs = `select=${encodeURIComponent(columns)}&order=${order}.asc&offset=${offset}&limit=${step}`;
    const page = await req(`${p.url}/rest/v1/${table}?${qs}`, { headers: authHeaders(p, token) });
    rows.push(...page);
    if (page.length < step) return rows;
  }
}

// The answer key is unreadable by any SELECT, admin or not - column-level
// grants, not RLS. admin_get_question_answers() is the SECURITY DEFINER
// escape hatch the app itself uses, one question at a time.
async function fetchAnswerKeys(p, token, ids) {
  const out = new Map();
  let done = 0;
  let failed = 0;
  for (let i = 0; i < ids.length; i += RPC_CONCURRENCY) {
    const batch = ids.slice(i, i + RPC_CONCURRENCY);
    await Promise.all(
      batch.map(async (id) => {
        try {
          const r = await req(`${p.url}/rest/v1/rpc/admin_get_question_answers`, {
            method: "POST",
            headers: { ...authHeaders(p, token), "Content-Type": "application/json" },
            body: JSON.stringify({ p_question_id: id }),
          });
          if (Array.isArray(r) && r[0]) out.set(id, r[0]);
        } catch {
          failed++;
        }
      }),
    );
    done += batch.length;
    if (done % 120 === 0 || done === ids.length) {
      process.stdout.write(`\r      answer keys: ${done}/${ids.length}${failed ? ` (${failed} failed)` : ""}   `);
    }
  }
  process.stdout.write("\n");
  if (failed) console.warn(`      WARNING: ${failed} answer keys could not be read - those questions import unanswered`);
  return out;
}

async function insertChunked(p, token, table, rows) {
  let n = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await req(`${p.url}/rest/v1/${table}`, {
      method: "POST",
      headers: {
        ...authHeaders(p, token),
        "Content-Type": "application/json",
        // merge-duplicates makes a re-run idempotent instead of erroring on
        // the primary key. Prefer: return=minimal keeps the response small.
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(chunk),
    });
    n += chunk.length;
    process.stdout.write(`\r      inserted ${n}/${rows.length}   `);
  }
  if (rows.length) process.stdout.write("\n");
  return n;
}

// ------------------------------ phases --------------------------------
async function doExport() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log(`\n=== EXPORT from ${OLD.url} ===`);
  const token = await login(OLD);
  console.log(`   signed in as ${OLD.email}`);

  const counts = {};
  for (const { name, order } of TABLES) {
    process.stdout.write(`   ${name} ... `);
    const rows = await selectAll(OLD, token, name, COLUMNS[name], order);
    process.stdout.write(`${rows.length} rows\n`);

    if (name === "questions" && rows.length) {
      const keys = await fetchAnswerKeys(OLD, token, rows.map((r) => r.id));
      rows.forEach((r) => Object.assign(r, keys.get(r.id) || {}));
    }

    fs.writeFileSync(path.join(OUT_DIR, `${name}.json`), JSON.stringify(rows, null, 2));
    counts[name] = rows.length;
  }

  fs.writeFileSync(path.join(OUT_DIR, "_counts.json"), JSON.stringify(counts, null, 2));
  console.log(`\n   written to ${OUT_DIR}`);
  return counts;
}

async function doImport() {
  console.log(`\n=== IMPORT into ${NEW.url} ===`);
  if (!fs.existsSync(OUT_DIR)) throw new Error(`no ${OUT_DIR} - run the export first`);
  const token = await login(NEW);
  console.log(`   signed in as ${NEW.email}`);

  const report = [];
  for (const { name, replaceAll } of TABLES) {
    const file = path.join(OUT_DIR, `${name}.json`);
    if (!fs.existsSync(file)) {
      console.log(`   ${name}: no export file, skipped`);
      report.push([name, "skipped (no export file)"]);
      continue;
    }
    let rows = JSON.parse(fs.readFileSync(file, "utf8"));
    if (!rows.length) {
      console.log(`   ${name}: empty`);
      report.push([name, "0"]);
      continue;
    }

    const fk = USER_FK[name];
    if (fk) rows = rows.map((r) => ({ ...r, [fk]: null }));

    console.log(`   ${name}: ${rows.length} rows`);
    try {
      // FRESH_PROJECT_SCHEMA.sql seeds homepage_sections with fresh uuids.
      // Importing the old rows on top would leave both sets in place and the
      // landing page would render every section twice, so clear it first.
      if (replaceAll) {
        await req(`${NEW.url}/rest/v1/${name}?id=not.is.null`, {
          method: "DELETE",
          headers: { ...authHeaders(NEW, token), Prefer: "return=minimal" },
        });
        console.log(`      cleared seeded rows first`);
      }
      const n = await insertChunked(NEW, token, name, rows);
      report.push([name, String(n)]);
    } catch (e) {
      console.error(`      FAILED: ${e.message}`);
      report.push([name, `FAILED - ${e.message.split("\n")[0]}`]);
    }
  }

  const md = [
    "# Content import summary",
    "",
    `- source: ${OLD.url}`,
    `- target: ${NEW.url}`,
    "",
    "| table | rows |",
    "|---|---|",
    ...report.map(([t, n]) => `| ${t} | ${n} |`),
    "",
    "Not migrated by design: auth.users, profiles, student_profiles,",
    "test_sessions, attempts, user_roles.",
    "",
    "If `questions.image_url` values point at the old project's storage",
    "domain, those images still live in the old bucket. They will keep",
    "loading while the old project exists, but should be re-uploaded to the",
    "new project's `question-images` bucket to be safe.",
    "",
  ].join("\n");
  fs.writeFileSync(path.join(OUT_DIR, "IMPORT-SUMMARY.md"), md);
  console.log(`\n   summary: content-export/IMPORT-SUMMARY.md`);
}

async function main() {
  const mode = (process.argv[2] || "both").toLowerCase();
  const placeholders = [OLD.key, OLD.email, OLD.password, NEW.url, NEW.key, NEW.email, NEW.password];
  if (placeholders.some((v) => v.includes("PASTE_"))) {
    console.error("Fill in the CONFIG block at the top of this file first.");
    process.exit(1);
  }
  if (mode === "export" || mode === "both") await doExport();
  if (mode === "import" || mode === "both") await doImport();
  console.log("\ndone.");
}

main().catch((e) => {
  console.error("\n" + e.message);
  process.exit(1);
});
