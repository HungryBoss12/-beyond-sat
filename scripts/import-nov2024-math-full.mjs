/**
 * Import DSAT November 2024 Math — 44 questions + answers from nov2024-questions.json
 * Run: node scripts/import-nov2024-math-full.mjs
 */
import fs from "fs";
import pg from "pg";

const PAPER_TITLE = "DSAT November 2024";
const SOURCE_MONTH = 11;
const SOURCE_YEAR = 2024;
const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";

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
        let v = l.slice(i + 1).trim().replace(/\s+#.*$/, "").trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

function normalizeChoices(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  if (typeof raw[0] === "object" && raw[0]?.id) return raw;
  return raw.slice(0, 4).map((text, i) => ({
    id: String.fromCharCode(65 + i),
    text: String(text),
  }));
}

function normalizePrompt(prompt) {
  if (!prompt) return null;
  const p = prompt.trim();
  if (p.includes("FIGURE NEEDED") && !p.startsWith(FIGURE_MARKER)) {
    const rest = p.replace(/\[FIGURE NEEDED[^\]]*\]\s*/i, "").trim();
    return rest ? `${FIGURE_MARKER}\n${rest}` : FIGURE_MARKER;
  }
  return p || null;
}

const raw = JSON.parse(fs.readFileSync("scripts/nov2024-questions.json", "utf8"));

// Patch answer key corrections from embedded DOCX key
const PATCHES = {
  "2-7": { correct_choice_id: "B" },
  "2-11": { correct_choice_id: "A" },
  "2-14": {
    choices: ["13", "14", "31", "65"],
    correct_choice_id: "D",
  },
};

const QUESTIONS = raw.map((q) => {
  const patch = PATCHES[`${q.module}-${q.position}`];
  const merged = patch ? { ...q, ...patch } : q;
  const kind = merged.kind === "grid_in" ? "grid_in" : "multiple_choice";
  let prompt = normalizePrompt(merged.prompt);
  if (prompt?.includes(FIGURE_MARKER)) {
    const lines = prompt.split("\n");
    if (lines.length > 1 && lines[0].includes("FIGURE NEEDED")) {
      prompt = FIGURE_MARKER;
    }
  }
  return {
    module: merged.module,
    position: merged.position,
    kind,
    prompt,
    question_text: merged.question_text?.trim() || `Question ${merged.position}`,
    choices: kind === "multiple_choice" ? normalizeChoices(merged.choices) : [],
    correct_choice_id:
      kind === "multiple_choice" ? merged.correct_choice_id?.toUpperCase() ?? null : null,
    correct_grid_answers:
      kind === "grid_in" ? (merged.correct_grid_answers?.filter(Boolean) ?? []) : null,
  };
});

function buildPayload(q) {
  return {
    section: "math",
    skill: "Algebra",
    difficulty: "C",
    kind: q.kind,
    prompt: q.prompt || null,
    question_text: q.question_text,
    choices: q.kind === "multiple_choice" ? q.choices : [],
    correct_choice_id: q.kind === "multiple_choice" ? q.correct_choice_id : null,
    correct_grid_answers: q.kind === "grid_in" ? q.correct_grid_answers : null,
    explanation: null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    module: q.module,
    position: q.position,
  };
}

async function main() {
  if (QUESTIONS.length !== 44) {
    throw new Error(`Expected 44 questions, got ${QUESTIONS.length}`);
  }
  console.log(`Importing ${QUESTIONS.length} questions for "${PAPER_TITLE}"`);

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
  if (existing.length) console.log(`Removed ${existing.length} prior test module(s)`);

  const byModule = { 1: [], 2: [] };
  let withAnswers = 0;

  for (const q of QUESTIONS) {
    const payload = buildPayload(q);
    const hasAnswer =
      payload.correct_choice_id ||
      (payload.correct_grid_answers && payload.correct_grid_answers.length);
    if (hasAnswer) withAnswers++;

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
    const title = moduleTitle(PAPER_TITLE, module);
    const { rows: testRows } = await client.query(
      `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
       values ($1,'math',$2,'C',$3,$4,null) returning id`,
      [title, module, SOURCE_MONTH, SOURCE_YEAR],
    );
    for (const item of items) {
      await client.query(
        `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
        [testRows[0].id, item.id, item.position],
      );
    }
    console.log(`Created "${title}" — ${items.length} questions`);
  }

  await client.end();
  console.log(`Done: ${QUESTIONS.length} questions (${withAnswers} with answer keys)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
