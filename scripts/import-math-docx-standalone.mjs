/**
 * Import math .docx via mammoth text extraction.
 * Usage: node scripts/import-math-docx-standalone.mjs
 */
import fs from "fs";
import mammoth from "mammoth";
import pg from "pg";

const DOCX_PATH =
  "c:\\Users\\javaz\\Downloads\\AyuGram Desktop\\May 2024 Math Version C (2).docx";
const PAPER_TITLE = "DSAT March 2024 v2";
const SOURCE_MONTH = 3;
const SOURCE_YEAR = 2024;

const QUESTION_OPENER = /^\s*(?:question\s+)?(\d{1,3})\s*[.)]\s*/i;
const CHOICE_OPENER = /^\s*\(?([A-D])\s*[).]\s+/i;

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

function splitInlineChoices(line) {
  const marks = [];
  const re = /(^|[\s\u00A0])\(?([A-D])\s*[).]\s*/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[2].charCodeAt(0) - 65 !== marks.length) continue;
    marks.push({ id: m[2], start: m.index + m[1].length, textAt: m.index + m[0].length });
  }
  if (marks.length < 2) return null;
  if (line.slice(0, marks[0].start).trim()) return null;
  const out = marks.map((mark, i) => ({
    id: mark.id,
    text: line.slice(mark.textAt, marks[i + 1]?.start ?? line.length).trim(),
  }));
  return out.every((c) => c.text) ? out : null;
}

function locateChoices(blocks) {
  const floor = Math.max(1, blocks.length - 12);
  for (let i = blocks.length - 1; i >= floor; i--) {
    const inline = splitInlineChoices(blocks[i]);
    if (inline) return { choices: inline, start: i, end: i };
    const stack = [];
    for (let j = i; j >= 0; j--) {
      const m = blocks[j].match(CHOICE_OPENER);
      if (!m) break;
      stack.unshift({ id: m[1], text: blocks[j].slice(m[0].length).trim() });
      if (m[1] === "A") break;
    }
    const ordered = stack.every((c, idx) => c.id === String.fromCharCode(65 + idx));
    if (stack.length >= 2 && ordered && stack[0].id === "A" && stack.every((c) => c.text)) {
      return { choices: stack, start: i - stack.length + 1, end: i };
    }
  }
  return null;
}

function parseSection(raw, module) {
  const lines = raw
    .split(/\n/)
    .map((l) => l.replace(/\u00A0/g, " ").trim())
    .filter((l) => l && !/^module\s+[12]$/i.test(l) && !/^may 2024 math/i.test(l));

  const groups = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(QUESTION_OPENER);
    if (m) {
      const n = Number(m[1]);
      const expected = current ? current.number + 1 : 1;
      const opens = current ? n >= expected && n <= expected + 3 : n === 1 || n === expected;
      if (opens) {
        if (current) groups.push(current);
        const rest = line.slice(m[0].length).trim();
        current = { number: n, blocks: rest ? [rest] : [] };
        continue;
      }
    }
    if (current) current.blocks.push(line);
  }
  if (current) groups.push(current);

  return groups.map(({ number, blocks }) => {
    const located = locateChoices(blocks);
    const choices = located?.choices ?? [];
    const remaining = located ? blocks.slice(0, located.start) : blocks;
    const stem = remaining[remaining.length - 1] ?? "";
    const prompt = remaining.slice(0, -1).join("\n\n");
    return {
      number,
      module,
      kind: choices.length ? "multiple_choice" : "grid_in",
      prompt,
      question_text: stem || `Question ${number}`,
      choices,
    };
  });
}

function parseText(raw) {
  const parts = raw.split(/\bModule\s+2\b/i);
  const mod1 = parseSection(parts[0] ?? raw, 1);
  const mod2 = parts.length > 1 ? parseSection(parts.slice(1).join("\nModule 2"), 2) : [];
  return [...mod1, ...mod2];
}

function buildPayload(q) {
  return {
    section: "math",
    skill: "Algebra",
    difficulty: "C",
    kind: q.kind,
    prompt: q.prompt || null,
    question_text: q.question_text,
    choices: q.choices,
    correct_choice_id: null,
    correct_grid_answers: null,
    explanation: null,
    image_url: null,
    source_month: SOURCE_MONTH,
    source_year: SOURCE_YEAR,
    module: q.module,
    position: q.number,
  };
}

async function main() {
  if (!fs.existsSync(DOCX_PATH)) throw new Error(`File not found: ${DOCX_PATH}`);

  const { value: text } = await mammoth.extractRawText({ path: DOCX_PATH });
  const parsed = parseText(text);
  console.log(`Parsed ${parsed.length} questions`);
  console.log(
    `Module 1: ${parsed.filter((q) => q.module === 1).length}, Module 2: ${parsed.filter((q) => q.module === 2).length}`,
  );

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

  const byModule = { 1: [], 2: [] };
  for (const q of parsed) {
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
        null,
      ],
    );
    byModule[payload.module].push({ id: rows[0].id, position: payload.position });
  }

  for (const module of [1, 2]) {
    const items = byModule[module].sort((a, b) => a.position - b.position);
    if (!items.length) continue;
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
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
