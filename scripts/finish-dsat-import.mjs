/**
 * Finish DSAT March 2024 scan import: extract remaining pages, apply answer key, upload.
 * Run: node scripts/finish-dsat-import.mjs
 */
import fs from "fs";
import pg from "pg";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

const PDF_PATH = "c:/Users/javaz/Downloads/DSAT March 2024.pdf";
const PROGRESS_PATH = "scripts/.import-dsat-progress.json";
const TITLE_BASE = "DSAT March 2024";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;
const PARTIAL_TEST_ID = "cecd46e1-bf52-4b27-b923-1ab0ff1a7703";

/** March 2024-A R&W answer key (unofficial, widely circulated). */
const RW_KEYS = {
  1: "CBBDACDBACCBCABCCADDADCDCBD".split(""),
  2: "CBADDCDCADCDBBBCAADDBCACADB".split(""),
};

const VISION_PROMPT = `You are extracting Digital SAT Reading & Writing questions from a scan of one exam page.
Return ONLY a JSON array. If no questions, return [].
Each object: number (integer if visible), section ("reading_writing"), question_text, choices (array of 4 strings without A/B prefixes), prompt (passage text if any).
Use <u>word</u> for underlined text. For tables/graphs add [FIGURE NEEDED: brief description] in prompt — do not redraw figures as text.
Mathematics notation: LaTeX in $...$ with doubled backslashes in JSON.`;

function loadEnv() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        const k = l.slice(0, i).trim();
        let v = l.slice(i + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [k, v];
      }),
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractJsonArray(text) {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

async function renderPage(doc, pageNum) {
  const page = await doc.getPage(pageNum);
  const vp = page.getViewport({ scale: 1.6 });
  const canvas = createCanvas(Math.floor(vp.width), Math.floor(vp.height));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const b64 = canvas.toBuffer("image/jpeg", { quality: 0.72 }).toString("base64");
  page.cleanup();
  return b64;
}

async function visionExtract(apiKey, b64) {
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
      temperature: 0.2,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "[]";
}

function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return "";
  return String(v);
}

function cleanChoice(text) {
  return text.replace(/^[A-D][.)]\s*/, "").replace(/^[A-D]\s+/, "").trim();
}

function itemToRec(item, fallbackNum, page) {
  const questionText = asText(
    item.question_text ?? item.question ?? item.text ?? item.stem,
  ).trim();
  if (!questionText) return null;
  const rawNum = Number(item.number ?? item.question_number ?? item.id ?? NaN);
  const number = Number.isFinite(rawNum) && rawNum > 0 ? Math.round(rawNum) : fallbackNum;
  const choices = Array.isArray(item.choices)
    ? item.choices.map((c) => cleanChoice(asText(c))).filter(Boolean)
    : [];
  const rec = {
    section: "reading_writing",
    skill: "Craft and Structure",
    difficulty: "C",
    kind: "multiple_choice",
    prompt: asText(item.prompt),
    question_text: questionText,
    correct: "",
    explanation: "",
    source_month: String(SOURCE_MONTH),
    source_year: String(SOURCE_YEAR),
    module: "1",
    _number: number,
    _page: page,
  };
  choices.slice(0, 4).forEach((text, i) => {
    rec[`choice_${String.fromCharCode(65 + i)}`] = text;
  });
  return rec;
}

/** Split into module blocks by extraction order + number reset. */
function assignModules(recs) {
  let module = 1;
  let prev = 0;
  for (const rec of recs) {
    if (prev >= 15 && rec._number <= 10 && rec._number < prev - 3) module = 2;
    rec.module = String(module);
    prev = rec._number;
  }
}

function dedupe(recs) {
  const seen = new Set();
  const out = [];
  for (const rec of recs) {
    const key = rec.question_text.slice(0, 160);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(rec);
  }
  return out;
}

function applyAnswerKeys(recs) {
  const byMod = { 1: [], 2: [] };
  for (const r of recs) byMod[r.module === "2" ? 2 : 1].push(r);
  for (const mod of [1, 2]) {
    byMod[mod].sort((a, b) => a._number - b._number);
    const keys = RW_KEYS[mod];
    byMod[mod].forEach((r, i) => {
      if (keys[i]) r.correct = keys[i];
    });
  }
}

function buildPayload(rec) {
  const choices = ["A", "B", "C", "D"]
    .map((id) => ({ id, text: (rec[`choice_${id}`] ?? "").trim() }))
    .filter((c) => c.text);
  const correct = (rec.correct ?? "").trim().toUpperCase();
  return {
    section: rec.section,
    skill: rec.skill,
    difficulty: "C",
    kind: "multiple_choice",
    prompt: rec.prompt || null,
    question_text: rec.question_text,
    choices,
    correct_choice_id: ["A", "B", "C", "D"].includes(correct) ? correct : null,
    correct_grid_answers: null,
    explanation: null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    created_by: null,
  };
}

async function main() {
  const env = loadEnv();
  let progress = { lastPage: 0, recs: [] };
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    for (const r of progress.recs) {
      if (!r._page) r._page = 0;
    }
    console.log(`Loaded ${progress.recs.length} drafts through page ${progress.lastPage}`);
  }

  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;

  for (let p = progress.lastPage + 1; p <= doc.numPages; p++) {
    console.log(`Extract page ${p}/${doc.numPages}…`);
    const b64 = await renderPage(doc, p);
    const raw = await visionExtract(env.OPENROUTER_API_KEY, b64);
    const items = extractJsonArray(raw) ?? [];
    for (const item of items) {
      const rec = itemToRec(item, progress.recs.length + 1, p);
      if (rec) progress.recs.push(rec);
    }
    console.log(`  +${items.length} (total ${progress.recs.length})`);
    progress.lastPage = p;
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
    await sleep(2000);
  }
  await doc.destroy();

  let unique = dedupe(progress.recs);
  assignModules(unique);
  applyAnswerKeys(unique);
  console.log(`Uploading ${unique.length} EBRW questions…`);

  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Remove prior partial import
  const { rows: oldLinks } = await client.query(
    `select question_id from public.test_questions where test_id = $1`,
    [PARTIAL_TEST_ID],
  );
  await client.query(`delete from public.test_questions where test_id = $1`, [PARTIAL_TEST_ID]);
  await client.query(`delete from public.tests where id = $1`, [PARTIAL_TEST_ID]);
  for (const { question_id } of oldLinks) {
    await client.query(`delete from public.questions where id = $1`, [question_id]);
  }
  console.log(`Removed partial test (${oldLinks.length} questions)`);

  const buckets = new Map();
  for (const rec of unique) {
    const key = rec.module;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(rec);
  }

  for (const [mod, recs] of buckets) {
    recs.sort((a, b) => a._number - b._number);
    const ids = [];
    for (const rec of recs) {
      const p = buildPayload(rec);
      const { rows } = await client.query(
        `insert into public.questions (
          section, skill, difficulty, kind, prompt, question_text, choices,
          correct_choice_id, correct_grid_answers, explanation, image_url,
          source_month, source_year, created_by
        ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14) returning id`,
        [
          p.section,
          p.skill,
          p.difficulty,
          p.kind,
          p.prompt,
          p.question_text,
          JSON.stringify(p.choices),
          p.correct_choice_id,
          p.correct_grid_answers,
          p.explanation,
          p.image_url,
          p.source_month,
          p.source_year,
          p.created_by,
        ],
      );
      ids.push(rows[0].id);
    }

    const title = `${TITLE_BASE} — EBRW Mod ${mod}`;
    const { rows: t } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
       values ($1,'reading_writing',$2,'C',$3,$4,null) returning id`,
      [title, Number(mod), SOURCE_MONTH, SOURCE_YEAR],
    );
    const testId = t[0].id;
    for (let i = 0; i < ids.length; i++) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [testId, ids[i], i + 1],
      );
    }
    const withKey = recs.filter((r) => r.correct).length;
    console.log(`Created "${title}" — ${ids.length} Q (${withKey} with answer key)`);
  }

  await client.end();
  fs.unlinkSync(PROGRESS_PATH);
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
