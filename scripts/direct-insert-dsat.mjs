/**
 * Direct Supabase insert for DSAT March 2024 (98 questions) — no AI APIs.
 * Run: node scripts/direct-insert-dsat.mjs
 */
import fs from "fs";
import pg from "pg";

const QUESTIONS_PATH = "scripts/dsat-march-2024-questions.json";
const TITLE_BASE = "DSAT March 2024";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

function moduleTitle(base, module) {
  return `${base} · Module ${module}`;
}

const PAPERS = [
  { base: TITLE_BASE, section: "reading_writing" },
  { base: TITLE_BASE, section: "math" },
];

export function loadEnv() {
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

function buildPayload(q) {
  const kind = q.kind === "grid_in" ? "grid_in" : "multiple_choice";
  return {
    section: q.section,
    skill: q.skill,
    difficulty: q.difficulty || "C",
    kind,
    prompt: q.prompt || null,
    question_text: q.question_text,
    choices: kind === "multiple_choice" ? q.choices : [],
    correct_choice_id: kind === "multiple_choice" ? q.correct_choice_id : null,
    correct_grid_answers: kind === "grid_in" ? q.correct_grid_answers : null,
    explanation: null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    created_by: null,
  };
}

async function deleteExisting(client) {
  const { rows: tests } = await client.query(
    `select id from public.tests where title like 'DSAT March 2024%'`,
  );
  let deletedQuestions = 0;
  for (const { id } of tests) {
    const { rows: links } = await client.query(
      `select question_id from public.test_questions where test_id = $1`,
      [id],
    );
    await client.query(`delete from public.test_questions where test_id = $1`, [id]);
    await client.query(`delete from public.tests where id = $1`, [id]);
    for (const { question_id } of links) {
      await client.query(`delete from public.questions where id = $1`, [question_id]);
      deletedQuestions++;
    }
  }
  console.log(`Deleted ${tests.length} prior test(s) and ${deletedQuestions} linked question(s)`);
}

async function main() {
  const questions = JSON.parse(fs.readFileSync(QUESTIONS_PATH, "utf8"));
  if (questions.length !== 98) {
    throw new Error(`Expected 98 questions, found ${questions.length}`);
  }

  const env = loadEnv();
  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  await deleteExisting(client);

  const idsByTest = new Map();
  for (const p of PAPERS) {
    idsByTest.set(`${p.section}|1`, []);
    idsByTest.set(`${p.section}|2`, []);
  }

  for (const q of questions) {
    const payload = buildPayload(q);
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
    const key = `${q.section}|${q.module}`;
    idsByTest.get(key).push({ id: rows[0].id, position: q.position });
  }

  const counts = {};
  for (const p of PAPERS) {
    for (const module of [1, 2]) {
      const key = `${p.section}|${module}`;
      const items = idsByTest.get(key).sort((a, b) => a.position - b.position);
      const title = moduleTitle(p.base, module);
      const { rows: testRows } = await client.query(
        `insert into public.tests (title, section, module, difficulty, source_month, source_year, created_by)
         values ($1,$2,$3,'C',$4,$5,null) returning id`,
        [title, p.section, module, SOURCE_MONTH, SOURCE_YEAR],
      );
      const testId = testRows[0].id;
      for (const item of items) {
        await client.query(
          `insert into public.test_questions (test_id, question_id, position) values ($1,$2,$3)`,
          [testId, item.id, item.position],
        );
      }
      counts[title] = items.length;
      console.log(`Created "${title}" — ${items.length} questions (test_id=${testId})`);
    }
  }

  await client.end();
  console.log("\nInsert counts per test:");
  console.log(JSON.stringify(counts, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
