/**
 * Normalize questions.image_url for imported papers: convert signed/absolute
 * storage URLs to durable object paths (client re-signs at display time via
 * resolveDisplayUrls). Skips external (non-Supabase) URLs.
 *
 * Run: node scripts/normalize-image-refs.mjs
 */
import fs from "node:fs";
import pg from "pg";

const PAPER_FILTERS = ["DSAT December 2024 C%", "DSAT May 2025%", "May 2025 INT%"];
const OBJECT_URL_RE = /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?#]+)\/([^?#]+)/i;

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

function toPath(url) {
  const m = OBJECT_URL_RE.exec(url ?? "");
  if (!m) return null;
  try {
    return { bucket: decodeURIComponent(m[1]), path: decodeURIComponent(m[2]) };
  } catch {
    return null;
  }
}

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
  `select distinct q.id, q.image_url
   from public.questions q
   join public.test_questions tq on tq.question_id = q.id
   join public.tests t on t.id = tq.test_id
   where (${PAPER_FILTERS.map((_, i) => `t.title ilike $${i + 1}`).join(" or ")})
     and q.image_url is not null`,
  PAPER_FILTERS,
);

let converted = 0;
let kept = 0;
for (const r of rows) {
  // Choice-level images too (rare, but normalize in the same pass).
  const parsed = toPath(r.image_url);
  if (!parsed) {
    kept++;
    continue;
  }
  // Only normalize question-images bucket to bare path; other buckets keep prefix.
  const next =
    parsed.bucket === "question-images"
      ? parsed.path
      : `${parsed.bucket}/${parsed.path}`;
  if (next === r.image_url) {
    kept++;
    continue;
  }
  await client.query(`update public.questions set image_url = $1, updated_at = now() where id = $2`, [
    next,
    r.id,
  ]);
  converted++;
}

// Choice images inside choices JSON.
const { rows: choiceRows } = await client.query(
  `select distinct q.id, q.choices
   from public.questions q
   join public.test_questions tq on tq.question_id = q.id
   join public.tests t on t.id = tq.test_id
   where (${PAPER_FILTERS.map((_, i) => `t.title ilike $${i + 1}`).join(" or ")})
     and q.choices @> '[{"image_url": "http"}]'`,
  PAPER_FILTERS,
);

let choiceConverted = 0;
for (const row of choiceRows) {
  let changed = false;
  const choices = (row.choices ?? []).map((c) => {
    if (!c?.image_url) return c;
    const parsed = toPath(c.image_url);
    if (!parsed) return c;
    const next =
      parsed.bucket === "question-images" ? parsed.path : `${parsed.bucket}/${parsed.path}`;
    if (next === c.image_url) return c;
    changed = true;
    return { ...c, image_url: next };
  });
  if (changed) {
    await client.query(`update public.questions set choices = $1::jsonb, updated_at = now() where id = $2`, [
      JSON.stringify(choices),
      row.id,
    ]);
    choiceConverted++;
  }
}

console.log(`image_url normalized: ${converted} (kept ${kept} non-storage URLs)`);
console.log(`choice-image rows normalized: ${choiceConverted}`);
await client.end();
process.exit(0);
