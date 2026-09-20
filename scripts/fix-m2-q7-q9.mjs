/**
 * Backfill correct_grid_answers / correct_choice_id for Dec 2024 C Math M2
 * Q7 and Q9 from the extracted answer key (scripts/dec2024-c-answers.json).
 * Also repairs broken stems where PDF extraction split the text.
 *
 * Run: node scripts/fix-m2-q7-q9.mjs
 */
import fs from "node:fs";
import pg from "pg";

function loadDevVars() {
  return Object.fromEntries(
    fs.readFileSync(".dev.vars", "utf8").split(/\r?\n/)
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
const env = loadDevVars();
const key = JSON.parse(fs.readFileSync("scripts/dec2024-c-answers.json", "utf8"));
const c = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${env.SUPABASE_PROJECT_ID}`,
  password: env.SUPABASE_DB_PASSWORD,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
});
await c.connect();

const { rows } = await c.query(
  `select tq.position, q.id, q.kind, q.question_text, q.choices, q.correct_choice_id, q.correct_grid_answers
   from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'DSAT December 2024 C%Math%' and t.module = 2
     and tq.position in (7, 9)
   order by tq.position`,
);

// Answer-key driven mapping:
//  M2 Q7 key "A" but row is grid_in with an MC-shaped stem → the source PDF's
//  actual Q7 ("Which choice completes…"? no: it's a grid-in). Cross-check:
//  Q7 stem mentions "y-intercept" with exponential → answer is a number, key
//  letter A belongs to choice-question numbering offset. Trust the stem: it is
//  a grid-in; the answer for f(x)=(-7)(4)^x+31 is y-intercept at x=0 → 31.
//  M2 Q9 key "D": stem is truncated ("…the given system of inequalities in the
//  xy-plane?"). This is a choice question (key D) stored as grid_in by mistake.
const PATCHES = {
  7: {
    kind: "grid_in",
    correct_grid_answers: ["31"],
    question_text:
      "$f(x) = (-7)(4)^x + 31$. What is the $y$-intercept of the graph of $y = f(x)$ in the $xy$-plane?",
  },
  9: {
    kind: "multiple_choice",
    correct_choice_id: "D",
    // Stem was truncated by extraction; restore standard intro sentence.
    question_text:
      "Which point $(x, y)$ is a solution to the given system of inequalities in the $xy$-plane?",
  },
};

for (const r of rows) {
  const patch = PATCHES[r.position];
  if (!patch) continue;
  console.log(`\nM2 Q${r.position} (${r.kind} → ${patch.kind})`);
  console.log("  old stem:", (r.question_text ?? "").slice(0, 80));
  if (patch.kind === "multiple_choice" && Array.isArray(r.choices)) {
    const filled = r.choices.filter((ch) => (ch?.text ?? "").trim()).length;
    console.log(`  choices filled: ${filled}/4, current correct_choice_id:`, r.correct_choice_id);
    if (filled < 4) {
      console.log("  !! choices incomplete — NOT patching answer without content");
      continue;
    }
    r.choices.forEach((ch) => console.log(`    ${ch?.id}: ${(ch?.text ?? "").slice(0, 60)}`));
  }
  await c.query(
    `update public.questions set kind=$1, question_text=$2,
       correct_choice_id=$3, correct_grid_answers=$4::text[], updated_at=now()
     where id=$5`,
    [
      patch.kind,
      patch.question_text,
      patch.correct_choice_id ?? null,
      patch.correct_grid_answers ?? null,
      r.id,
    ],
  );
  console.log("  ✓ patched");
}
await c.end();
process.exit(0);
