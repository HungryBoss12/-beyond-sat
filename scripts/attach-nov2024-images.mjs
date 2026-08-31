/**
 * Upload Nov 2024 math figures and attach to DSAT November 2024 questions.
 * Run: node scripts/attach-nov2024-images.mjs
 */
import fs from "fs";
import crypto from "crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PAPER_TITLE = "DSAT November 2024";
const PROJECT_REF = "qlzvngegsemrzmyxwykl";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const MEDIA_DIR = "tmp-nov2024-math/word/media";
const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

const IMAGE_MAP = [
  { module: 1, position: 1, file: "image1.png" },
  { module: 1, position: 8, file: "image2.png" },
  { module: 1, position: 10, file: "image3.png" },
  { module: 1, position: 13, file: "image4.png" },
  { module: 2, position: 7, file: "image5.png" },
  { module: 2, position: 11, file: "image6.png" },
  { module: 2, position: 21, file: "image7.png" },
];

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim().replace(/\s+#.*$/, "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

async function getServiceRoleKey(accessToken) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not fetch API keys: ${res.status}`);
  const keys = await res.json();
  const svc = keys.find((k) => k.name === "service_role");
  if (!svc?.api_key) throw new Error("service_role key not found");
  return svc.api_key;
}

async function uploadFigure(supabase, filePath) {
  const buf = fs.readFileSync(filePath);
  const path = `${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage.from("question-images").upload(path, buf, {
    contentType: "image/png",
    upsert: false,
  });
  if (error) throw new Error(`Upload failed: ${error.message}`);
  const { data, error: signErr } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (signErr || !data?.signedUrl) throw new Error(signErr?.message ?? "No signed URL");
  return data.signedUrl;
}

async function main() {
  const env = loadEnv();
  const serviceKey = await getServiceRoleKey(env.SUPABASE_ACCESS_TOKEN);
  const supabase = createClient(SUPABASE_URL, serviceKey);
  const client = new pg.Client({
    host: `db.${PROJECT_REF}.supabase.co`,
    port: 5432,
    database: "postgres",
    user: "postgres",
    password: env.SUPABASE_DB_PASSWORD,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  let attached = 0;
  for (const { module, position, file } of IMAGE_MAP) {
    const localPath = `${MEDIA_DIR}/${file}`;
    const testTitle = `${PAPER_TITLE} · Module ${module}`;
    const { rows } = await client.query(
      `select q.id, q.prompt from public.questions q
       join public.test_questions tq on tq.question_id = q.id
       join public.tests t on t.id = tq.test_id
       where t.title = $1 and tq.position = $2`,
      [testTitle, position],
    );
    if (!rows.length) {
      console.warn(`Skip M${module} Q${position}: not found`);
      continue;
    }
    const imageUrl = await uploadFigure(supabase, localPath);
    const newPrompt = rows[0].prompt?.includes("FIGURE NEEDED") ? FIGURE_MARKER : rows[0].prompt;
    await client.query(
      `update public.questions set image_url = $1, prompt = $2, updated_at = now() where id = $3`,
      [imageUrl, newPrompt, rows[0].id],
    );
    attached++;
    console.log(`Attached ${file} → ${testTitle} Q${position}`);
  }
  await client.end();
  console.log(`Done: ${attached}/${IMAGE_MAP.length} figures attached`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
