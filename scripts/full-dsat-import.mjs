/**
 * Full re-extract DSAT March 2024 PDF (all pages) and upload both EBRW modules.
 */
import fs from "fs";
import pg from "pg";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_PATH = "c:/Users/javaz/Downloads/DSAT March 2024.pdf";
const PROGRESS_PATH = "scripts/.import-dsat-full-progress.json";
const TITLE_BASE = "DSAT March 2024";

const RW_KEYS = {
  1: "CBBDACDBACCBCABCCADDADCDCBD".split(""),
  2: "CBADDCDCADCDBBBCAADDBCACADB".split(""),
};

const VISION_PROMPT = `Extract Digital SAT Reading & Writing questions from this exam page scan.
Return ONLY a JSON array (no markdown). Empty array if no questions (cover, blank, answer key).
Each object: number (printed Q# if visible), question_text, choices (array of 4 strings, no letter prefixes), prompt (passage/shared text).
Use <u>word</u> for underlined words. For charts/tables write [FIGURE NEEDED: description] in prompt only.`;

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
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function extractJsonArray(text) {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```/g, "");
  const start = cleaned.indexOf("[");
  const end = cleaned.lastIndexOf("]");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(cleaned.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function renderPage(doc, n) {
  const page = await doc.getPage(n);
  const vp = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const b64 = canvas.toBuffer("image/jpeg", { quality: 0.72 }).toString("base64");
  page.cleanup();
  return b64;
}

async function extractPage(apiKey, b64) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://beyondsat.app",
      "X-Title": "Beyond SAT",
    },
    body: JSON.stringify({
      model: "dots-studio/dots-3-note-preview:free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_PROMPT },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } },
          ],
        },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    }),
  });
  if (!res.ok) throw new Error(`OR ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "[]";
}

function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return "";
  return String(v);
}

function cleanChoice(t) {
  return t.replace(/^[A-D][.)]\s*/, "").replace(/^[A-D]\s+/, "").trim();
}

function toRec(item, page) {
  const qt = asText(item.question_text ?? item.question ?? item.stem).trim();
  if (!qt) return null;
  const n = Number(item.number ?? item.question_number ?? item.id ?? NaN);
  const number = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
  const choices = (Array.isArray(item.choices) ? item.choices : [])
    .map((c) => cleanChoice(asText(c)))
    .filter(Boolean);
  const rec = {
    section: "reading_writing",
    skill: "Craft and Structure",
    difficulty: "C",
    kind: "multiple_choice",
    prompt: asText(item.prompt),
    question_text: qt,
    correct: "",
    module: "1",
    _number: number ?? 0,
    _page: page,
  };
  choices.slice(0, 4).forEach((t, i) => {
    rec[`choice_${String.fromCharCode(65 + i)}`] = t;
  });
  return rec;
}

function finalize(recs) {
  // Dedupe by question text, keep first by page order
  recs.sort((a, b) => a._page - b._page);
  const seen = new Set();
  const unique = [];
  for (const r of recs) {
    const k = r.question_text.slice(0, 150);
    if (seen.has(k)) continue;
    seen.add(k);
    unique.push(r);
  }

  // Assign modules by number reset in page order
  let mod = 1;
  let prev = 0;
  for (const r of unique) {
    if (prev >= 15 && r._number > 0 && r._number <= 10 && r._number < prev - 3) mod = 2;
    r.module = String(mod);
    if (r._number > 0) prev = r._number;
  }

  // Fill missing numbers per module
  for (const m of ["1", "2"]) {
    const bucket = unique.filter((r) => r.module === m);
    let n = 1;
    for (const r of bucket) {
      if (!r._number) r._number = n;
      n = Math.max(n, r._number + 1);
    }
    bucket.sort((a, b) => a._number - b._number);
    const keys = RW_KEYS[m === "2" ? 2 : 1];
    bucket.forEach((r, i) => {
      if (keys[i]) r.correct = keys[i];
    });
  }
  return unique;
}

async function replaceTests(client, unique) {
  // Delete existing DSAT March 2024 tests
  const { rows: tests } = await client.query(
    `select id from public.tests where title like 'DSAT March 2024%'`,
  );
  for (const { id } of tests) {
    const { rows: links } = await client.query(
      `select question_id from public.test_questions where test_id = $1`,
      [id],
    );
    await client.query(`delete from public.test_questions where test_id = $1`, [id]);
    await client.query(`delete from public.tests where id = $1`, [id]);
    for (const { question_id } of links) {
      await client.query(`delete from public.questions where id = $1`, [question_id]);
    }
  }
  console.log(`Cleared ${tests.length} prior test set(s)`);

  for (const mod of ["1", "2"]) {
    const bucket = unique.filter((r) => r.module === mod).sort((a, b) => a._number - b._number);
    if (!bucket.length) continue;
    const ids = [];
    for (const rec of bucket) {
      const choices = ["A", "B", "C", "D"]
        .map((id) => ({ id, text: (rec[`choice_${id}`] ?? "").trim() }))
        .filter((c) => c.text);
      const correct = rec.correct?.toUpperCase();
      const { rows } = await client.query(
        `insert into public.questions (
          section, skill, difficulty, kind, prompt, question_text, choices,
          correct_choice_id, correct_grid_answers, explanation, image_url,
          source_month, source_year, created_by
        ) values ('reading_writing',$1,'C','multiple_choice',$2,$3,$4::jsonb,$5,null,null,null,3,2024,null)
        returning id`,
        [
          rec.skill,
          rec.prompt || null,
          rec.question_text,
          JSON.stringify(choices),
          ["A", "B", "C", "D"].includes(correct) ? correct : null,
        ],
      );
      ids.push(rows[0].id);
    }
    const title = `${TITLE_BASE} — EBRW Mod ${mod}`;
    const { rows: t } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year)
       values ($1,'reading_writing',$2,'C',3,2024) returning id`,
      [title, Number(mod)],
    );
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [t[0].id, ids[i], i + 1],
      );
    }
    console.log(`Created "${title}" — ${ids.length} questions`);
  }
}

async function main() {
  const env = loadEnv();
  let progress = fs.existsSync(PROGRESS_PATH)
    ? JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"))
    : { lastPage: 0, recs: [] };

  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;

  for (let p = progress.lastPage + 1; p <= doc.numPages; p++) {
    console.log(`Page ${p}/${doc.numPages}`);
    try {
      const b64 = await renderPage(doc, p);
      const raw = await extractPage(env.OPENROUTER_API_KEY, b64);
      const items = extractJsonArray(raw);
      for (const item of items) {
        const rec = toRec(item, p);
        if (rec) progress.recs.push(rec);
      }
      console.log(`  +${items.length} (total ${progress.recs.length})`);
    } catch (e) {
      console.warn(`  skip: ${e.message}`);
    }
    progress.lastPage = p;
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
    await sleep(2500);
  }
  await doc.destroy();

  const unique = finalize(progress.recs);
  console.log(`Final: ${unique.filter((r) => r.module === "1").length} mod1, ${unique.filter((r) => r.module === "2").length} mod2`);

  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await replaceTests(client, unique);
  await client.end();
  fs.unlinkSync(PROGRESS_PATH);
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
