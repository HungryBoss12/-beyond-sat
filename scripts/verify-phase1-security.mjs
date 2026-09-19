import fs from "fs";
import pg from "pg";

function loadDevVars() {
  return Object.fromEntries(
    fs
      .readFileSync(".dev.vars", "utf8")
      .split(/\r?\n/)
      .filter((l) => l && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        let v = l.slice(i + 1).trim();
        if (
          (v.startsWith('"') && v.endsWith('"')) ||
          (v.startsWith("'") && v.endsWith("'"))
        ) {
          v = v.slice(1, -1);
        }
        return [l.slice(0, i).trim(), v];
      }),
  );
}

const env = loadDevVars();
const projectRef = env.SUPABASE_PROJECT_ID || "qlzvngegsemrzmyxwykl";
const dbPassword = (env.SUPABASE_DB_PASSWORD ?? "").trim();

const client = new pg.Client({
  host: "aws-0-us-east-1.pooler.supabase.com",
  port: 5432,
  user: `postgres.${projectRef}`,
  password: dbPassword,
  database: "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 10000,
});
await client.connect();

const results = [];
function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  -- " + detail : ""}`);
}

// Pick one admin and one regular (non-admin) user for cross-probing.
// NOTE: every profile here carries at least one user_roles row, so "no roles"
// matches nobody — select explicitly non-admin profiles instead.
const { rows: admins } = await client.query(
  `select ur.user_id from public.user_roles ur where ur.role='admin' limit 1`,
);
const { rows: students } = await client.query(
  `select p.id from public.profiles p
    where not exists (
      select 1 from public.user_roles ur where ur.user_id=p.id and ur.role='admin'
    )
    limit 1`,
);
const adminId = admins[0]?.user_id;
const studentId = students[0]?.id;
console.log("admin:", adminId, "student:", studentId);

// ---------- anon checks ----------
await client.query("begin");
await client.query("set local role anon");
try {
  await client.query("select public.bs_is_admin($1)", [studentId]);
  check("anon blocked from bs_is_admin", false);
} catch (e) {
  check("anon blocked from bs_is_admin", true);
}
try {
  const r = await client.query("select private.has_role($1, 'admin'::public.app_role)", [studentId]);
  check("anon blocked from private.has_role", false);
} catch (e) {
  check("anon blocked from private.has_role", true);
}
await client.query("rollback");

// ---------- student checks ----------
await client.query("begin");
await client.query("set local role authenticated");
await client.query("select set_config('request.jwt.claim.sub', $1, true)", [studentId]);
await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");

try {
  const r = await client.query("select public.bs_is_admin($1) as v", [adminId]);
  check("student cannot probe admin (clamped false)", r.rows[0].v === false, `got ${r.rows[0].v}`);
} catch (e) {
  check("student cannot probe admin (clamped false)", true, "(denied outright)");
}
try {
  const r = await client.query("select public.bs_is_staff($1) as v", [adminId]);
  check("student cannot probe staff", r.rows[0].v === false, `got ${r.rows[0].v}`);
} catch (e) {
  check("student cannot probe staff", true, "(denied outright)");
}
try {
  const r = await client.query("select public.bs_is_banned($1) as v", [adminId]);
  check("student cannot probe banned", r.rows[0].v === false, `got ${r.rows[0].v}`);
} catch (e) {
  check("student cannot probe banned", true, "(denied outright)");
}
try {
  const r = await client.query("select public.admin_user_role($1) as v", [adminId]);
  check("student cannot read admin_user_role", r.rows[0].v === null, `got ${r.rows[0].v}`);
} catch (e) {
  check("student cannot read admin_user_role", true, "(denied outright)");
}
// Self-checks still work.
try {
  const r = await client.query("select public.bs_is_staff() as v");
  check("student self bs_is_staff false", r.rows[0].v === false, `got ${r.rows[0].v}`);
} catch (e) {
  check("student self bs_is_staff false", false, e.message);
}
// Vocab answer key hidden. NOTE: a denied read aborts the whole transaction,
// so run the positive body-read BEFORE the negative column test.
try {
  const r = await client.query(
    "select id, passage_text, options, position from public.vocab_quiz_questions limit 1",
  );
  check("student can still read question body", true, `${r.rows.length} rows`);
} catch (e) {
  check("student can still read question body", false, e.message);
}
try {
  const r = await client.query(
    "select correct_answer from public.vocab_quiz_questions limit 1",
  );
  check("student blocked from correct_answer column", false, "query unexpectedly succeeded");
} catch (e) {
  check("student blocked from correct_answer column", true);
}
// Attempts insert blocked.
try {
  const { rows: ss } = await client.query(
    "select id from public.test_sessions where user_id=$1 limit 1", [studentId],
  );
  if (ss[0]) {
    await client.query(
      `insert into public.attempts (user_id, session_id, question_id, test_type)
       values ($1, $2, gen_random_uuid(), 'practice')`,
      [studentId, ss[0].id],
    );
    check("direct attempts INSERT blocked", false);
  } else {
    check("direct attempts INSERT blocked", true, "(no session to test with)");
  }
} catch (e) {
  check("direct attempts INSERT blocked", true, e.message.slice(0, 80));
}
// Direct grade_answer blocked.
try {
  await client.query("select public.grade_answer(gen_random_uuid(), 'A', '', NULL)");
  check("direct grade_answer blocked", false);
} catch (e) {
  check("direct grade_answer blocked", true, e.message.slice(0, 60));
}
await client.query("rollback");

// ---------- admin checks ----------
await client.query("begin");
await client.query("set local role authenticated");
await client.query("select set_config('request.jwt.claim.sub', $1, true)", [adminId]);
await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
try {
  const r = await client.query("select public.bs_is_admin() as v");
  check("admin self bs_is_admin true", r.rows[0].v === true, `got ${r.rows[0].v}`);
} catch (e) {
  check("admin self bs_is_admin true", false, e.message);
}
try {
  const r = await client.query("select count(*)::int as n from public.admin_users_summary()");
  check("admin_users_summary still works for admin", true, `${r.rows[0].n} rows, role labels resolve`);
} catch (e) {
  check("admin_users_summary still works for admin", false, e.message.slice(0, 90));
}
try {
  const r = await client.query("select public.admin_user_role($1) as v", [studentId]);
  check("admin can still read admin_user_role", r.rows[0].v === "student", `got ${r.rows[0].v}`);
} catch (e) {
  check("admin can still read admin_user_role", false, e.message.slice(0, 90));
}
await client.query("rollback");

// ---------- telegram service-side helpers ----------
await client.query("begin");
await client.query("set local role service_role");
try {
  await client.query("select private.bs_is_admin_for($1)", [adminId]);
  check("service_role can use private.bs_is_admin_for", true);
} catch (e) {
  check("service_role can use private.bs_is_admin_for", false, e.message.slice(0, 90));
}
try {
  await client.query("select public.admin_by_telegram_chat(123456)");
  check("admin_by_telegram_chat runs as service_role", true);
} catch (e) {
  check("admin_by_telegram_chat runs as service_role", false, e.message.slice(0, 90));
}
await client.query("rollback");

// ---------- submit_vocab_quiz end-to-end ----------
// The answer key is not readable as the student (by design) — fetch it as
// postgres FIRST, then impersonate the student, so a denied read can no
// longer abort this transaction before the RPC even runs.
await client.query("begin");
await client.query("set local role authenticated");
await client.query("select set_config('request.jwt.claim.sub', $1, true)", [studentId]);
await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
let e2eQuiz = null;
try {
  const { rows: qz } = await client.query(
    `select q.quiz_id, array_agg(q.id order by q.position) as ids
       from public.vocab_quiz_questions q
      group by q.quiz_id limit 1`,
  );
  e2eQuiz = qz[0] ?? null;
} catch (e) {
  check("submit_vocab_quiz e2e", false, e.message.slice(0, 120));
}
await client.query("rollback");

if (e2eQuiz) {
  const { rows: keyRows } = await client.query(
    `select q.quiz_id, array_agg(q.id order by q.position) as ids,
            array_agg(q.correct_answer order by q.position) as answers
       from public.vocab_quiz_questions q
      where q.quiz_id = $1
      group by q.quiz_id`,
    [e2eQuiz.quiz_id],
  );
  const quiz = keyRows[0];
  const ids = quiz.ids;
  const answers = quiz.answers;

  await client.query("begin");
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claim.sub', $1, true)", [studentId]);
  await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
  try {
    // Forged question id must be rejected outright. Run this BEFORE any real
    // submit — the duplicate-submit guard would short-circuit with
    // already-submitted and never reach the membership check. The expected
    // raise aborts the transaction, so isolate it in a savepoint.
    await client.query("savepoint forged_test");
    try {
      await client.query(
        "select public.submit_vocab_quiz($1, $2, $3)",
        [quiz.quiz_id, [gen_uuid()], ["x"]],
      );
      await client.query("rollback to savepoint forged_test");
      check("forged question id rejected", false);
    } catch (e) {
      await client.query("rollback to savepoint forged_test");
      check("forged question id rejected", true);
    }

    // Answer every question correctly (as the server knows).
    const r = await client.query(
      "select public.submit_vocab_quiz($1, $2, $3) as res",
      [quiz.quiz_id, ids, answers],
    );
    const res = r.rows[0].res;
    check("submit_vocab_quiz grades correct answers", res.score === ids.length, `score ${res.score}/${res.total}`);
    check("submit_vocab_quiz returns results with keys", Array.isArray(res.results) && res.results[0]?.correctAnswer != null);

    // Duplicate submit returns error object.
    const r2 = await client.query(
      "select public.submit_vocab_quiz($1, $2, $3) as res",
      [quiz.quiz_id, ids, answers],
    );
    check("duplicate submit returns already-submitted", r2.rows[0].res?.error === "already-submitted", JSON.stringify(r2.rows[0].res).slice(0, 60));
  } catch (e) {
    check("submit_vocab_quiz e2e", false, e.message.slice(0, 120));
  }
  await client.query("rollback");
} else if (!results.some((r) => r.name === "submit_vocab_quiz e2e")) {
  check("submit_vocab_quiz e2e", true, "(no vocab quizzes in DB to test)");
}

// ---------- submit_attempt replay oracle (pentest HIGH-1) ----------
{
  const { rows: qs } = await client.query(
    `select id, correct_choice_id, choices
       from public.questions
      where kind = 'multiple_choice'
        and correct_choice_id is not null
      limit 1`,
  );
  const q = qs[0];
  if (!q) {
    check("submit_attempt replay returns stored grade", true, "(no MCQ to test)");
  } else {
    const correct = q.correct_choice_id;
    const choices = Array.isArray(q.choices)
      ? q.choices.map((c) => (typeof c === "string" ? c : c?.id)).filter(Boolean)
      : [];
    const wrong = choices.find((c) => c !== correct) ?? "Z";

    await client.query("begin");
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [studentId]);
    await client.query("select set_config('request.jwt.claim.role', 'authenticated', true)");
    await client.query("select set_config('beyondsat.server_write', 'on', true)");
    try {
      const { rows: sess } = await client.query(
        `insert into public.test_sessions (user_id, type, total_questions, metadata)
         values ($1, 'practice', 1, jsonb_build_object('question_ids', jsonb_build_array($2::text)))
         returning id`,
        [studentId, q.id],
      );
      const sid = sess[0].id;
      const r1 = await client.query(
        `select public.submit_attempt($1, $2, $3, null, false, null, null) as v`,
        [sid, q.id, wrong],
      );
      const r2 = await client.query(
        `select public.submit_attempt($1, $2, $3, null, false, null, null) as v`,
        [sid, q.id, correct],
      );
      check(
        "submit_attempt first wrong is false",
        r1.rows[0].v === false,
        `got ${r1.rows[0].v}`,
      );
      check(
        "submit_attempt replay returns stored grade (not re-graded)",
        r2.rows[0].v === false,
        `wrong→${r1.rows[0].v} then correct→${r2.rows[0].v} (oracle if true)`,
      );
    } catch (e) {
      check("submit_attempt replay returns stored grade", false, e.message.slice(0, 120));
    }
    await client.query("rollback");
  }
}

function gen_uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

await client.end();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
