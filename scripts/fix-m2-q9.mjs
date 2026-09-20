/**
 * Repair Dec 2024 C Math M2 Q9: import mis-parsed this MC question as grid_in
 * and lost the choices + stem. Restore from the PDF text dump
 * (scripts/dec2024-c-dump.txt, "9. { y<42-7x / y/7>10 ... }"). Key: D.
 * Run: node scripts/fix-m2-q9.mjs
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
  `select q.id from public.tests t
   join public.test_questions tq on tq.test_id = t.id
   join public.questions q on q.id = tq.question_id
   where t.title ilike 'DSAT December 2024 C%Math%' and t.module = 2 and tq.position = 9`,
);
if (!rows.length) throw new Error("M2 Q9 not found");

// Source (PDF dump, glyphs mapped):
//   9. { y < 42 - 7x ; y/7 > 10 }
//   Which inequality represents the x values for all solutions (x, y) that
//   satisfy the given system of inequalities in the xy-plane?
//   A) x > 6   B) x < 6   C) x > -4   D) x < -4
// Check: y/7 > 10 → y > 70; y < 42 - 7x → 70 < y < 42 - 7x needs 42 - 7x > 70
// → -7x > 28 → x < -4. Key D confirms.
const stem =
  "$\\begin{cases} y < 42 - 7x \\\\ \\dfrac{y}{7} > 10 \\end{cases}$";
const questionText =
  "Which inequality represents the $x$ values for all solutions $(x, y)$ that satisfy the given system of inequalities in the $xy$-plane?";
const choices = [
  { id: "A", text: "$x > 6$" },
  { id: "B", text: "$x < 6$" },
  { id: "C", text: "$x > -4$" },
  { id: "D", text: "$x < -4$" },
];

await c.query(
  `update public.questions set kind='multiple_choice', prompt=$1, question_text=$2,
     choices=$3::jsonb, correct_choice_id='D', correct_grid_answers=null, updated_at=now()
   where id=$4`,
  [stem, questionText, JSON.stringify(choices), rows[0].id],
);
console.log("M2 Q9 repaired: MC, stem + 4 choices restored, correct=D");
await c.end();
process.exit(0);
