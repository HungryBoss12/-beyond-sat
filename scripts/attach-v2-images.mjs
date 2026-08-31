/**
 * Upload v2 math figures from the DOCX and attach to DSAT March 2024 v2 questions.
 * Run: node scripts/attach-v2-images.mjs
 */
import fs from "fs";
import crypto from "crypto";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PAPER_TITLE = "DSAT March 2024 v2";
const PROJECT_REF = "qlzvngegsemrzmyxwykl";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const MEDIA_DIR = "tmp-math-v2/word/media";
const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

/** Mapped from document.xml embeds → question positions. */
const IMAGE_MAP = [
  { module: 1, position: 1, file: "image1.png" },
  { module: 1, position: 4, file: "image2.png" },
  { module: 1, position: 6, file: "image3.png" },
  { module: 1, position: 7, file: "image4.png" },
  { module: 1, position: 9, file: "image5.png" },
  { module: 1, position: 16, file: "image6.png" },
  { module: 1, position: 17, file: "image7.png" },
  { module: 2, position: 1, file: "image8.png" },
  { module: 2, position: 2, file: "image9.png" },
  { module: 2, position: 3, file: "image10.png" },
  { module: 2, position: 11, file: "image11.png" },
];

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
        v = v.replace(/\s+#.*$/, "").trim();
        return [l.slice(0, i).trim(), v];
      }),
  );
}

async function getServiceRoleKey(accessToken) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/api-keys`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Could not fetch API keys: ${res.status} ${await res.text()}`);
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
  if (error) throw new Error(`Upload failed for ${filePath}: ${error.message}`);

  const { data, error: signErr } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (signErr || !data?.signedUrl) {
    throw new Error(signErr?.message ?? "Could not create signed URL");
  }
  return data.signedUrl;
}

async function main() {
  const env = loadEnv();
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error("SUPABASE_ACCESS_TOKEN missing in .dev.vars");
  if (!env.SUPABASE_DB_PASSWORD) throw new Error("SUPABASE_DB_PASSWORD missing in .dev.vars");

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
    if (!fs.existsSync(localPath)) {
      console.warn(`Skip M${module} Q${position}: missing ${localPath}`);
      continue;
    }

    const testTitle = `${PAPER_TITLE} · Module ${module}`;
    const { rows } = await client.query(
      `select q.id, q.prompt, q.image_url
       from public.questions q
       join public.test_questions tq on tq.question_id = q.id
       join public.tests t on t.id = tq.test_id
       where t.title = $1 and tq.position = $2`,
      [testTitle, position],
    );
    if (!rows.length) {
      console.warn(`Skip M${module} Q${position}: question not found in DB`);
      continue;
    }

    const { id, prompt } = rows[0];
    const imageUrl = await uploadFigure(supabase, localPath);
    const newPrompt = prompt === FIGURE_MARKER ? null : prompt;

    await client.query(
      `update public.questions set image_url = $1, prompt = $2, updated_at = now() where id = $3`,
      [imageUrl, newPrompt, id],
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
