/** Import saved progress JSON into Supabase. */
import fs from "fs";
import pg from "pg";

const PROGRESS_PATH = "scripts/.import-dsat-progress.json";
const TITLE_BASE = "DSAT March 2024";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

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

function cleanChoice(text) {
  return text.replace(/^[A-D]\s+/, "").trim();
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
    .map((id) => ({ id, text: cleanChoice(rec[`choice_${id}`] ?? "") }))
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
  const progress = JSON.parse(fs.readFileSync(PROGRESS_PATH, "utf8"));
  const env = loadEnv();

  const seen = new Set();
  const unique = [];
  for (const rec of progress.recs) {
    const key = rec.question_text.slice(0, 180);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(rec);
  }
  stampModules(unique);
  console.log(`Importing ${unique.length} unique questions (from ${progress.lastPage} pages)`);

  const client = new pg.Client({
    connectionString: `postgresql://postgres:${encodeURIComponent(env.SUPABASE_DB_PASSWORD)}@db.qlzvngegsemrzmyxwykl.supabase.co:5432/postgres`,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  const insertedByBucket = new Map();
  for (const rec of unique) {
    const payload = buildQuestionPayload(rec);
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
    const title = `${TITLE_BASE} — ${sectionLabel} Mod ${mod} (partial)`;
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
    console.log(`Created "${title}" — ${items.length} questions (test_id=${testId})`);
  }

  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
