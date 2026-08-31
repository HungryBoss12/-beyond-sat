/**
 * One-off scan import: DSAT March 2024.pdf → Supabase questions + test sets.
 * Run: node scripts/import-dsat-march-2024.mjs
 */
import fs from "fs";
import pg from "pg";
import { createCanvas } from "@napi-rs/canvas";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { GoogleGenAI } from "@google/genai";

const PDF_PATH = process.argv[2] ?? "c:/Users/javaz/Downloads/DSAT March 2024.pdf";
const PROGRESS_PATH = "scripts/.import-dsat-progress.json";
const TITLE_BASE = "DSAT March 2024";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

const VISION_EXTRACTION_PROMPT = fs.readFileSync(
  "src/lib/ai/prompts.ts",
  "utf8",
).includes("VISION_EXTRACTION_PROMPT")
  ? `You are extracting Digital SAT practice questions from a scan of one exam page.
Return ONLY a JSON array. If no questions, return [].
Each object: number (optional), section ("math" or "reading_writing" if obvious), question_text, choices (array), prompt (optional passage), correct (only if printed).
Mathematics: LaTeX in $...$ with doubled backslashes in JSON.
For figures use [FIGURE NEEDED: description] in prompt — do not redraw graphs in text.`
  : "";

const VISION_RECHECK_PROMPT = `Verify and fix the JSON array of SAT questions. Return ONLY a JSON array. Do not invent content.`;

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
  return { mimeType: "image/jpeg", data: b64 };
}

async function geminiExtract(ai, image, openRouterKey) {
  try {
    const res = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: "user",
          parts: [
            { text: VISION_EXTRACTION_PROMPT },
            { inlineData: { mimeType: image.mimeType, data: image.data } },
          ],
        },
      ],
      config: {
        temperature: 0.2,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });
    return res.text?.trim() ?? "";
  } catch (e) {
    if (e.status !== 429 || !openRouterKey) throw e;
    console.warn("  Gemini quota — falling back to OpenRouter vision");
    return openRouterVisionExtract(openRouterKey, image);
  }
}

async function openRouterVisionExtract(apiKey, image) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://beyondsat.app",
      "X-Title": "Beyond SAT",
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-nano-12b-v2-vl:free",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: VISION_EXTRACTION_PROMPT },
            {
              type: "image_url",
              image_url: { url: `data:${image.mimeType};base64,${image.data}` },
            },
          ],
        },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter vision ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? "[]";
}

async function nemotronRecheck(apiKey, prior) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
      "HTTP-Referer": "https://beyondsat.app",
      "X-Title": "Beyond SAT",
    },
    body: JSON.stringify({
      model: "nvidia/nemotron-3-ultra-550b-a55b:free",
      messages: [
        { role: "system", content: "Return only a JSON array." },
        { role: "user", content: `${VISION_RECHECK_PROMPT}\n\nFirst pass:\n${prior}` },
      ],
      temperature: 0.2,
      max_tokens: 8192,
    }),
  });
  if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? prior;
}

const RW_SKILLS = [
  "Craft and Structure",
  "Information and Ideas",
  "Standard English Conventions",
  "Expression of Ideas",
];
const MATH_SKILLS = ["Algebra", "Advanced Math", "Problem-Solving and Data Analysis", "Geometry and Trigonometry"];

function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(String).join(", ");
  if (typeof v === "object") return "";
  return String(v);
}

function itemToRec(item, fallbackNum) {
  const questionText = asText(item.question_text ?? item.question ?? item.text).trim();
  if (!questionText) return null;

  const rawNum = Number(item.number ?? item.question_number ?? NaN);
  const number = Number.isFinite(rawNum) && rawNum > 0 ? Math.round(rawNum) : fallbackNum;

  let section = "reading_writing";
  if (item.section === "math") section = "math";
  else if (item.section === "reading_writing") section = "reading_writing";

  const skills = section === "math" ? MATH_SKILLS : RW_SKILLS;
  const claimed = asText(item.skill).trim();
  const skill = skills.includes(claimed) ? claimed : skills[0];

  const choices = Array.isArray(item.choices)
    ? item.choices.map((c) => asText(c).trim()).filter(Boolean)
    : [];
  const kind =
    asText(item.kind).trim() === "grid_in" || (choices.length === 0 && section === "math")
      ? "grid_in"
      : "multiple_choice";

  const rec = {
    section,
    skill,
    difficulty: "C",
    kind,
    prompt: asText(item.prompt),
    question_text: questionText,
    correct: asText(item.correct ?? item.answer).trim(),
    explanation: asText(item.explanation),
    source_month: String(SOURCE_MONTH),
    source_year: String(SOURCE_YEAR),
    module: "1",
    _number: number,
  };
  choices.slice(0, 4).forEach((text, i) => {
    rec[`choice_${String.fromCharCode(65 + i)}`] = text;
  });
  return rec;
}

function stampModules(recs) {
  let current = 1;
  let prev = 0;
  for (const rec of recs) {
    const n = rec._number;
    if (prev > 0 && n <= 5 && prev >= 20) current = 2;
    rec.module = String(current);
    prev = n;
  }
}

function buildQuestionPayload(rec) {
  const choices = ["A", "B", "C", "D"]
    .map((id) => ({ id, text: (rec[`choice_${id}`] ?? "").trim() }))
    .filter((c) => c.text);
  const kind = rec.kind === "grid_in" ? "grid_in" : "multiple_choice";
  const correct = (rec.correct ?? "").trim().toUpperCase();
  return {
    section: rec.section,
    skill: rec.skill,
    difficulty: rec.difficulty || "C",
    kind,
    prompt: rec.prompt || null,
    question_text: rec.question_text,
    choices: kind === "multiple_choice" ? choices : [],
    correct_choice_id:
      kind === "multiple_choice" && ["A", "B", "C", "D"].includes(correct) ? correct : null,
    correct_grid_answers: kind === "grid_in" && rec.correct ? [rec.correct] : null,
    explanation: rec.explanation || null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    created_by: null,
  };
}

async function main() {
  const env = loadEnv();
  const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

  let progress = { lastPage: 0, recs: [] };
  if (fs.existsSync(PROGRESS_PATH)) {
    progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
    console.log(`Resuming from page ${progress.lastPage + 1}, ${progress.recs.length} drafts so far`);
  }

  const data = new Uint8Array(fs.readFileSync(PDF_PATH));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  console.log(`PDF: ${doc.numPages} pages`);

  for (let p = progress.lastPage + 1; p <= doc.numPages; p++) {
    console.log(`Page ${p}/${doc.numPages}…`);
    try {
      const image = await renderPage(doc, p);
      let extracted = await geminiExtract(ai, image, env.OPENROUTER_API_KEY);
      try {
        extracted = await nemotronRecheck(env.OPENROUTER_API_KEY, extracted);
      } catch (e) {
        console.warn(`  recheck skipped: ${e.message}`);
      }
      const items = extractJsonArray(extracted) ?? [];
      for (const raw of items) {
        if (!raw || typeof raw !== "object") continue;
        const rec = itemToRec(raw, progress.recs.length + 1);
        if (rec) progress.recs.push(rec);
      }
      console.log(`  +${items.length} items (total ${progress.recs.length})`);
    } catch (e) {
      console.error(`  FAILED page ${p}:`, e.message);
      progress.lastPage = p - 1;
      fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
      await doc.destroy();
      throw e;
    }
    progress.lastPage = p;
    fs.writeFileSync(PROGRESS_PATH, JSON.stringify(progress));
    await sleep(1500);
  }
  await doc.destroy();

  // Dedupe by question text
  const seen = new Set();
  const unique = [];
  for (const rec of progress.recs) {
    const key = rec.question_text.slice(0, 200);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(rec);
  }
  stampModules(unique);
  console.log(`Unique questions: ${unique.length}`);

  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const buckets = new Map();
  for (const rec of unique) {
    const key = `${rec.section}|${rec.module}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(rec);
  }

  for (const [key, recs] of buckets) {
    recs.sort((a, b) => a._number - b._number);
  }

  const insertedByBucket = new Map();

  for (const rec of unique) {
    const payload = buildQuestionPayload(rec);
    if (!payload.question_text) continue;
    const { rows } = await client.query(
      `insert into public.questions (
        section, skill, difficulty, kind, prompt, question_text, choices,
        correct_choice_id, correct_grid_answers, explanation, image_url,
        source_month, source_year, created_by
      ) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12,$13,$14)
      returning id`,
      [
        payload.section,
        payload.skill,
        payload.difficulty,
        payload.kind,
        payload.prompt,
        payload.question_text,
        JSON.stringify(payload.choices),
        payload.correct_choice_id,
        payload.correct_grid_answers,
        payload.explanation,
        payload.image_url,
        payload.source_month,
        payload.source_year,
        payload.created_by,
      ],
    );
    const id = rows[0].id;
    const bkey = `${rec.section}|${rec.module}`;
    if (!insertedByBucket.has(bkey)) insertedByBucket.set(bkey, []);
    insertedByBucket.get(bkey).push({ id, rec });
  }

  for (const [key, items] of insertedByBucket) {
    const [section, mod] = key.split("|");
    const sectionLabel = section === "math" ? "Math" : "EBRW";
    const title = `${TITLE_BASE} — ${sectionLabel} Mod ${mod}`;
    const { rows: testRows } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
       values ($1,$2,$3,'C',$4,$5,null) returning id`,
      [title, section, Number(mod), SOURCE_MONTH, SOURCE_YEAR],
    );
    const testId = testRows[0].id;
    items.sort((a, b) => a.rec._number - b.rec._number);
    for (let i = 0; i < items.length; i++) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [testId, items[i].id, i + 1],
      );
    }
    console.log(`Created test "${title}" with ${items.length} questions`);
  }

  await client.end();
  fs.unlinkSync(PROGRESS_PATH);
  console.log("DONE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
