/**
 * Verify normalized image paths resolve: sign each stored path via the
 * Supabase Storage API (service role) and HEAD the signed URL.
 * Run: node scripts/verify-image-paths.mjs
 */
import fs from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PAPER_FILTERS = ["DSAT December 2024 C%", "DSAT May 2025%", "May 2025 INT%"];

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
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!serviceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing from .dev.vars");
const supabase = createClient(`https://qlzvngegsemrzmyxwykl.supabase.co`, serviceKey);

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
  `select distinct t.title, tq.position, q.image_url
   from public.questions q
   join public.test_questions tq on tq.question_id = q.id
   join public.tests t on t.id = tq.test_id
   where (${PAPER_FILTERS.map((_, i) => `t.title ilike $${i + 1}`).join(" or ")})
     and q.image_url is not null
     and q.image_url not like 'http%'`,
  PAPER_FILTERS,
);

console.log(`checking ${rows.length} image paths…`);
const failures = [];
const byPath = new Map();
for (const r of rows) {
  const ref = r.image_url;
  if (!ref) {
    console.log("  (unexpected null ref row:", r.title, "Q" + r.position, ")");
    continue;
  }
  // Accept bare path (question-images bucket) or "bucket/path" prefix.
  const bucketPath = ref.includes("/")
    ? ref.startsWith("question-images/")
      ? { bucket: "question-images", path: ref.slice("question-images/".length) }
      : { bucket: "question-images", path: ref }
    : { bucket: "question-images", path: ref };
  if (!byPath.has(bucketPath.path)) byPath.set(bucketPath.path, []);
  byPath.get(bucketPath.path).push(r);
}

const paths = [...byPath.keys()];
for (let i = 0; i < paths.length; i += 40) {
  const chunk = paths.slice(i, i + 40);
  const { data, error } = await supabase.storage.from("question-images").createSignedUrls(chunk, 60);
  if (error) {
    console.error("sign failed:", error.message);
    continue;
  }
  for (const row of data ?? []) {
    if (row.error || !row.signedUrl) {
      for (const r of byPath.get(row.path) ?? []) {
        failures.push(`${r.title} Q${r.position}: sign failed for ${row.path}`);
      }
      continue;
    }
    try {
      const res = await fetch(row.signedUrl, { method: "HEAD", signal: AbortSignal.timeout(10000) });
      if (!res.ok) {
        for (const r of byPath.get(row.path) ?? []) {
          failures.push(`${r.title} Q${r.position}: HTTP ${res.status}`);
        }
      }
    } catch (e) {
      for (const r of byPath.get(row.path) ?? []) {
        failures.push(`${r.title} Q${r.position}: ${e.message?.slice(0, 50)}`);
      }
    }
  }
}

console.log(failures.length === 0 ? "ALL IMAGES OK" : `FAILURES: ${failures.length}`);
for (const f of failures) console.log("  -", f);
await client.end();
process.exit(failures.length ? 1 : 0);
