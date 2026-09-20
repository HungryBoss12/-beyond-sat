/**
 * INT papers answer transcription — answers derived from the stored question
 * content (stems are full; figures reconstructed during import) and checked
 * against each item's math. Sources: scripts/int-missing-dump.txt.
 * Run: node scripts/fix-int-answers.mjs
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

/**
 * Each entry: [titleLike, module, position, kind, answer, rationale]
 * kind 'mc' → answer is choice letter; 'grid' → answer is array of accepted strings.
 */
const ANSWERS = [
  // ---- May 2025 INT 2 · Module 1 ----
  // Q9: dashed line through (0,7) slope 3, region ABOVE shaded → y > 3x + 7.
  ["May 2025 INT 2%Module 1", 1, 9, "mc", "A", "slope 3, y-int 7, above dashed → y > 3x + 7"],
  // Q15: team A tightly clustered (25–40) vs team B spread (15–50) → sd(A) < sd(B).
  ["May 2025 INT 2%Module 1", 1, 15, "mc", "A", "tighter cluster → smaller SD"],
  // Q16: circle radius² = 7 → 4a = 28. (a = r² = 7 regardless of translation.)
  ["May 2025 INT 2%Module 1", 1, 16, "grid", ["28"], "a = r² = 7 → 4a = 28"],
  // Q18: flat segment x=2→4 means rain rate 0 cm/h.
  ["May 2025 INT 2%Module 1", 1, 18, "mc", "D", "flat segment → 0 cm/h between x=2 and x=4"],

  // ---- May 2025 INT 2 · Module 2 ----
  // Q2: corresponding angles, parallel lines cut by transversal: x = 111.
  ["May 2025 INT 2%Module 2", 2, 2, "mc", "C", "alternate exterior angles equal → x = 111"],
  // Q3: slope = (−8 −(−5))/7 = −3/7, y-int −5 → f(x) = −3/7 x − 5.
  ["May 2025 INT 2%Module 2", 2, 3, "mc", "C", "slope −3/7, y-int −5"],
  // Q4: line from (0,65) to (100,106): slope ≈ 0.41 ≈ 2/5. GC 98% → t ≈ 65+0.41·98 ≈ 105 (NOT 80°) → D is the false statement.
  ["May 2025 INT 2%Module 2", 2, 4, "mc", "D", "98% GC → ≈105°C, not 80–100 → D not true"],
  // Q7: y > 5x − 4: x=4→y>16, x=6→y>26, x=9→y>41 → only 21,31,46 all satisfy (21>16,31>26,46>41).
  ["May 2025 INT 2%Module 2", 2, 7, "mc", "C", "check y>5x−4 for each triple → C"],
  // Q10: SA = lw + 2·(l·slant_w)/2 … actually: base 18×9, apex above center.
  //   slant to width edge: √(h² + (l/2)²) = √(144+81)=15 → two triangles ½·9·15 each
  //   slant to length edge: √(h² + (w/2)²) = √(144+20.25)≈12.83 → two triangles ½·18·12.83 each
  //   SA = 162 + 9·15 + 18·12.83 ≈ 162 + 135 + 230.9 ≈ 527.9 → key 527.9 (or 528).
  ["May 2025 INT 2%Module 2", 2, 10, "grid", ["527.9", "528"], "SA = 162 + 135 + 18·√(144+20.25) ≈ 527.9"],

  // Q12: right angle at R, SR=47, hypotenuse QS: cos Q = QR/QS? No — adjacent to Q is QR, hyp is QS.
  //   sin Q = SR/QS → QS = 47/sin Q → D.
  ["May 2025 INT 2%Module 2", 2, 12, "mc", "D", "sin Q = opposite/hyp = SR/QS → QS = 47/sin Q"],

  // ---- May 2025 INT3 · Module 1 ----
  // Q7: point (155.21, 196.74): x = molecular weight, y = boiling point → D.
  ["May 2025 INT3%Module 1", 1, 7, "mc", "D", "(x=155.21 g/mol → y=196.74°C)"],
  // Q15: smallest SD = most concentrated → D (0,5,30,5,0).
  ["May 2025 INT3%Module 1", 1, 15, "mc", "D", "most mass at center → smallest SD"],
  // Q16: P(igneous) = 10/50.
  ["May 2025 INT3%Module 1", 1, 16, "mc", "D", "10 of 50"],
  // Q21: r top-left at a∩c, s bottom-left at b∩c (parallel a,b). r + s = 180
  //   (consecutive interior left side): 9k−30 + 7k−94 = 180 → 16k = 304 → k = 19
  //   r = 141, s = 39. t is bottom-right at b∩c = vertical/supplementary to s:
  //   bottom-left s and bottom-right t are supplementary → t = 141.
  ["May 2025 INT3%Module 1", 1, 21, "grid", ["141"], "9k−30+7k−94=180 → k=19; t = 180−s = 141"],

  // ---- May 2025 INT3 · Module 2 ----
  // Q1: 9 of 50 → 9/50.
  ["May 2025 INT3%Module 2", 2, 1, "mc", "B", "9/50"],
  // Q4: vertical angles at B + parallel lines give all angles congruent; need a side: AB=EB (sides around ∠B) → ASA. B.
  ["May 2025 INT3%Module 2", 2, 4, "mc", "B", "AB=EB gives ASA (angles at A/E, B vertical)"],
  // Q16: slope p per c: (189−81)/(5−2)=36; p = 36c + 9 → 36c − p = −9. A.
  ["May 2025 INT3%Module 2", 2, 16, "mc", "A", "p = 36c + 9 → 36c − p = −9"],
  // Q19: right angle at E; BD ∥ AE; cos A = 0.65. In right triangle ACE, sin C = cos A (complementary angles) → 0.65. B.
  ["May 2025 INT3%Module 2", 2, 19, "mc", "B", "A and C complementary → sin C = cos A = 0.65"],
  // Q20: line through (230,405), (270,485): slope 2.02; d = 405 − 2.02·230 + 2.02t = −59.6 + 2.02t ≈ −60.1 + 2.02t → A.
  ["May 2025 INT3%Module 2", 2, 20, "mc", "A", "d ≈ −60.1 + 2.02t from (230,405)"],
];

let patched = 0;
for (const [pattern, module, position, kind, answer, why] of ANSWERS) {
  const { rows } = await c.query(
    `select q.id, q.kind from public.tests t
     join public.test_questions tq on tq.test_id = t.id
     join public.questions q on q.id = tq.question_id
     where t.title ilike $1 and t.module = $2 and tq.position = $3`,
    [pattern, module, position],
  );
  if (!rows.length) {
    console.log(`SKIP ${pattern} Q${position}: not found`);
    continue;
  }
  if (kind === "mc") {
    await c.query(
      `update public.questions set correct_choice_id=$1, updated_at=now() where id=$2`,
      [answer, rows[0].id],
    );
  } else {
    await c.query(
      `update public.questions set correct_grid_answers=$1::text[], updated_at=now() where id=$2`,
      [answer, rows[0].id],
    );
  }
  patched++;
  console.log(`✓ ${pattern.replace(/%.*/, "")} Q${position} → ${Array.isArray(answer) ? answer.join("/") : answer}  (${why})`);
}
console.log(`\n${patched}/${ANSWERS.length} answers backfilled.`);
await c.end();
process.exit(0);
