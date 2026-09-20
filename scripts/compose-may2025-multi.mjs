/**
 * Compose multi-screenshot May 2025 questions into one vertical PNG and update image_url.
 */
import fs from "fs";
import crypto from "crypto";
import sharp from "sharp";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

const PROJECT_REF = "qlzvngegsemrzmyxwykl";
const SUPABASE_URL = `https://${PROJECT_REF}.supabase.co`;
const MEDIA = "scripts/may2025-math-pages/unzipped/word/media";
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365;

const MULTI = [
  { module: 1, position: 3, files: ["image3.png", "image4.png", "image5.png", "image6.png", "image7.png"] },
  { module: 1, position: 7, files: ["image11.png", "image12.png"] },
  { module: 1, position: 15, files: ["image20.png", "image21.png", "image22.png", "image23.png", "image24.png"] },
  { module: 2, position: 1, files: ["image32.png", "image33.png"] },
  { module: 2, position: 4, files: ["image36.png", "image37.png"] },
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
  if (!res.ok) throw new Error(`keys ${res.status}`);
  const keys = await res.json();
  const svc = keys.find((k) => k.name === "service_role" || k.name === "service_role key");
  const key = svc?.api_key ?? keys.find((k) => String(k.name).includes("service"))?.api_key;
  if (!key) throw new Error("no service_role");
  return key;
}

async function compose(files) {
  const metas = await Promise.all(
    files.map(async (f) => {
      const buf = fs.readFileSync(`${MEDIA}/${f}`);
      const img = sharp(buf);
      const meta = await img.metadata();
      return { buf, width: meta.width ?? 0, height: meta.height ?? 0 };
    }),
  );
  const width = Math.max(...metas.map((m) => m.width));
  const height = metas.reduce((s, m) => s + m.height, 0);
  const resized = await Promise.all(
    metas.map(async (m) => {
      if (m.width === width) return { input: m.buf, height: m.height };
      const out = await sharp(m.buf).resize({ width, fit: "contain", background: "#fff" }).png().toBuffer();
      const meta = await sharp(out).metadata();
      return { input: out, height: meta.height ?? m.height };
    }),
  );
  let top = 0;
  const composites = resized.map((r) => {
    const c = { input: r.input, top, left: 0 };
    top += r.height;
    return c;
  });
  const totalH = resized.reduce((s, r) => s + r.height, 0);
  return sharp({
    create: { width, height: totalH, channels: 3, background: "#ffffff" },
  })
    .composite(composites)
    .png()
    .toBuffer();
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

  for (const item of MULTI) {
    const title = `DSAT May 2025 · Module ${item.module}`;
    const { rows } = await client.query(
      `select q.id from public.tests t
       join public.test_questions tq on tq.test_id = t.id
       join public.questions q on q.id = tq.question_id
       where t.title = $1 and tq.position = $2`,
      [title, item.position],
    );
    if (!rows.length) {
      console.log("missing", title, item.position);
      continue;
    }
    process.stdout.write(`compose M${item.module} Q${item.position}… `);
    const buf = await compose(item.files);
    const path = `may2025-math/${crypto.randomUUID()}.png`;
    const { error } = await supabase.storage.from("question-images").upload(path, buf, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) throw new Error(error.message);
    // Store the durable object path (client re-signs at display time); a long
    //-lived signed URL would expire and 403 in the player.
    await client.query(`update public.questions set image_url = $1 where id = $2`, [
      path,
      rows[0].id,
    ]);
    console.log("ok", rows[0].id);
  }

  await client.end();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
