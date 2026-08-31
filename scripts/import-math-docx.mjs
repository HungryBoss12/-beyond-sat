/**
 * Import a math .docx into Supabase as a paired paper (Module 1 + Module 2).
 * Usage: node scripts/import-math-docx.mjs "<path-to.docx>" "<paper title>"
 */
import fs from "fs";
import pg from "pg";
import { readDocx } from "../src/lib/import/docx.ts";
import { blocksToDrafts, stampDraftModules } from "../src/lib/import/parse.ts";

const DOCX_PATH =
  process.argv[2] ??
  "c:\\Users\\javaz\\Downloads\\AyuGram Desktop\\May 2024 Math Version C (2).docx";
const PAPER_TITLE = process.argv[3] ?? "DSAT March 2024 v2";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

function moduleTitle(base, module) {
  return `${base} · Module ${module}`;
}

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

function buildPayload(draft) {
  const r = draft.rec;
  const kind = r.kind === "grid_in" ? "grid_in" : "multiple_choice";
  const choices =
    kind === "multiple_choice"
      ? ["A", "B", "C", "D"]
          .map((id) => ({ id, text: (r[`choice_${id}`] ?? "").trim() }))
          .filter((c) => c.text)
      : [];
  const correct = (r.correct ?? "").trim();
  return {
    section: "math",
    skill: r.skill || "Algebra",
    difficulty: r.difficulty || "C",
    kind,
    prompt: r.prompt?.trim() || null,
    question_text: r.question_text?.trim() || `Question ${draft.number}`,
    choices,
    correct_choice_id:
      kind === "multiple_choice" && /^[A-D]$/i.test(correct) ? correct.toUpperCase() : null,
    correct_grid_answers: kind === "grid_in" && correct ? [correct] : null,
    explanation: r.explanation?.trim() || null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    module: draft.rec.module === "2" ? 2 : 1,
    position: draft.number,
  };
}

async function main() {
  if (!fs.existsSync(DOCX_PATH)) {
    throw new Error(`File not found: ${DOCX_PATH}`);
  }

  const buf = fs.readFileSync(DOCX_PATH);
  const blocks = await readDocx(new Blob([buf]));
  const parsed = blocksToDrafts(blocks, {
    section: "math",
    skill: "Algebra",
    difficulty: "C",
    source_month: String(SOURCE_MONTH),
    source_year: String(SOURCE_YEAR),
  });
  const drafts = stampDraftModules(parsed.drafts, "both");

  console.log(`Parsed ${drafts.length} question(s) from ${blocks.length} block(s)`);
  if (parsed.notes.length) console.log("Notes:", parsed.notes.join(" | "));
  const mod1 = drafts.filter((d) => d.rec.module === "1");
  const mod2 = drafts.filter((d) => d.rec.module === "2");
  console.log(`Module 1: ${mod1.length}, Module 2: ${mod2.length}`);

  if (drafts.length === 0) {
    throw new Error("No questions parsed — check DOCX formatting.");
  }

  const warnings = drafts.filter(
    (d) => !d.rec.question_text?.trim() || (!d.rec.choice_A && d.rec.kind !== "grid_in"),
  );
  if (warnings.length) {
    console.warn(`${warnings.length} draft(s) may be incomplete (missing stem or choices).`);
  }

  const env = loadEnv();
  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const { rows: existing } = await client.query(
    `select id from public.tests where title like $1`,
    [`${PAPER_TITLE}%`],
  );
  for (const { id } of existing) {
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
  if (existing.length) {
    console.log(`Removed ${existing.length} prior test row(s) for "${PAPER_TITLE}"`);
  }

  const byModule = { 1: [], 2: [] };
  for (const d of drafts) {
    const payload = buildPayload(d);
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
        null,
      ],
    );
    byModule[payload.module].push({ id: rows[0].id, position: payload.position });
  }

  for (const module of [1, 2]) {
    const items = byModule[module].sort((a, b) => a.position - b.position);
    if (items.length === 0) continue;
    const title = moduleTitle(PAPER_TITLE, module);
    const { rows: testRows } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
       values ($1,'math',$2,'C',$3,$4,null) returning id`,
      [title, module, SOURCE_MONTH, SOURCE_YEAR],
    );
    const testId = testRows[0].id;
    for (const item of items) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [testId, item.id, item.position],
      );
    }
    console.log(`Created "${title}" — ${items.length} questions`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
