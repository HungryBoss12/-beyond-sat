import { supabase } from "@/integrations/supabase/client";
import type { Section, Difficulty } from "./sat";
import { questionCountFor, rawToScaled, skillsFor } from "./sat";
import { format } from "date-fns";

export type TestType = "practice" | "daily" | "mock";

export type PracticeFilters = {
  section: Section;
  skill?: string | null;
  difficulty?: Difficulty | null;
  limit?: number;
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getUser();
  const uid = data.user?.id;
  if (!uid) throw new Error("Not signed in");
  return uid;
}

/** Empty import placeholders — never serve these in practice. */
export function isStubQuestion(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  const lower = t.toLowerCase();
  return (
    lower.startsWith("missing question") ||
    lower.startsWith("[missing") ||
    lower === "missing"
  );
}

function skillMatchesSection(skill: string | null | undefined, section: Section): boolean {
  if (!skill?.trim()) return false;
  const want = skillsFor(section).map((s) => s.toLowerCase());
  return want.includes(skill.trim().toLowerCase());
}

export async function startPracticeSession(f: PracticeFilters): Promise<string> {
  const uid = await currentUserId();
  const limit = f.limit ?? 20;
  /* Skip empty / placeholder stubs and skills that don't belong to this section. */
  let q = supabase
    .from("questions")
    .select("id,skill,question_text")
    .eq("section", f.section);
  if (f.skill) q = q.eq("skill", f.skill);
  if (f.difficulty) q = q.eq("difficulty", f.difficulty);
  q = q.order("created_at", { ascending: false }).limit(Math.max(limit * 5, 100));
  const { data: qs, error: qErr } = await q;
  if (qErr) throw qErr;

  const ids = (qs ?? [])
    .filter(
      (row) =>
        !isStubQuestion(row.question_text as string | null) &&
        skillMatchesSection(row.skill as string | null, f.section),
    )
    .slice(0, limit)
    .map((r) => r.id as string);

  if (ids.length === 0) throw new Error("No questions match this filter yet.");

  const { data: sess, error } = await supabase
    .from("test_sessions")
    .insert({
      user_id: uid,
      type: "practice",
      total_questions: ids.length,
      metadata: {
        question_ids: ids,
        section: f.section,
        skill: f.skill ?? null,
        difficulty: f.difficulty ?? null,
      },
    })
    .select("id")
    .single();
  if (error) throw error;
  return sess.id as string;
}

async function questionsForTests(testIds: string[]): Promise<string[]> {
  if (testIds.length === 0) return [];
  const { data } = await supabase
    .from("test_questions")
    .select("test_id, question_id, position")
    .in("test_id", testIds)
    .order("position", { ascending: true });
  const orderMap = new Map(testIds.map((id, i) => [id, i]));
  const rows = (
    (data ?? []) as { test_id: string; question_id: string; position: number }[]
  ).slice();
  rows.sort((a, b) => {
    const ta = orderMap.get(a.test_id) ?? 0;
    const tb = orderMap.get(b.test_id) ?? 0;
    if (ta !== tb) return ta - tb;
    return a.position - b.position;
  });
  return rows.map((r) => r.question_id);
}

export async function startDailySession(): Promise<{ sessionId: string; resumed: boolean }> {
  const uid = await currentUserId();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: dt, error: dtErr } = await supabase
    .from("daily_tests")
    .select("id")
    .eq("date", today)
    .maybeSingle();
  if (dtErr) throw dtErr;
  if (!dt) throw new Error("No daily test is available for today.");

  const { data: existing } = await supabase
    .from("test_sessions")
    .select("id,completed_at")
    .eq("user_id", uid)
    .eq("daily_test_id", dt.id)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) {
    return { sessionId: existing[0].id as string, resumed: true };
  }

  // Prefer linked tests; fallback to legacy per-question rows
  let ids: string[] = [];
  const { data: linkedTests } = await supabase
    .from("daily_test_tests")
    .select("test_id, position")
    .eq("daily_test_id", dt.id)
    .order("position", { ascending: true });
  if (linkedTests && linkedTests.length > 0) {
    ids = await questionsForTests(linkedTests.map((r) => r.test_id as string));
  }
  if (ids.length === 0) {
    const { data: dq } = await supabase
      .from("daily_test_questions")
      .select("question_id, position")
      .eq("daily_test_id", dt.id)
      .order("position", { ascending: true });
    ids = (dq ?? []).map((r) => r.question_id as string);
  }
  if (ids.length === 0) throw new Error("Today's daily test has no questions yet.");

  const { data: sess, error } = await supabase
    .from("test_sessions")
    .insert({
      user_id: uid,
      type: "daily",
      daily_test_id: dt.id,
      total_questions: ids.length,
      metadata: { question_ids: ids },
    })
    .select("id")
    .single();
  if (error) throw error;
  return { sessionId: sess.id as string, resumed: false };
}

/**
 * Start (or resume) a session over one dated test set.
 *
 * The third caller of `questionsForTests`, and the reason the practice screen can
 * stop listing question text: a student picks "December 2024" and the questions
 * arrive through a session, where `grade_answer()` is the only thing that ever
 * returns an answer. Nothing about the set's contents is readable before it
 * starts.
 *
 * `type` stays `'practice'` — the set is identified by `metadata.test_id`, so
 * this needs no enum migration and every existing consumer of a practice session
 * (the runner, the review screen, analysis) keeps working unchanged. The resume
 * check mirrors `startDailySession`: leaving a set half-finished and coming back
 * must not create a second session and lose the answers already given.
 */
export async function startTestSetSession(
  testId: string,
): Promise<{ sessionId: string; resumed: boolean }> {
  const uid = await currentUserId();

  /* Readability check before anything else. `test_questions` stays readable to
     everyone — locking it down would break dailies and mocks built on unpublished
     sets, see PRACTICE_SETS.sql §2 — so this is what stops a student starting a
     half-built set by pasting its id. The row simply isn't visible to them under
     the `tests read published` policy, so `null` means "not yours to start". */
  const { data: test } = await supabase.from("tests").select("id").eq("id", testId).maybeSingle();
  if (!test) throw new Error("That practice set isn't available.");

  /* `metadata->>test_id` rather than a column: `test_sessions` has
     `daily_test_id` and `mock_exam_id` but no `test_id`, and adding one would be
     a migration for something the metadata JSON already carries. */
  const { data: existing } = await supabase
    .from("test_sessions")
    .select("id")
    .eq("user_id", uid)
    .eq("type", "practice")
    .is("completed_at", null)
    .filter("metadata->>test_id", "eq", testId)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) {
    return { sessionId: existing[0].id as string, resumed: true };
  }

  const ids = await questionsForTests([testId]);
  if (ids.length === 0) throw new Error("This test set has no questions yet.");

  const { data: sess, error } = await supabase
    .from("test_sessions")
    .insert({
      user_id: uid,
      type: "practice",
      total_questions: ids.length,
      metadata: { question_ids: ids, test_id: testId },
    })
    .select("id")
    .single();
  if (error) throw error;
  return { sessionId: sess.id as string, resumed: false };
}

export async function startMockSession(
  mockExamId: string,
): Promise<{ sessionId: string; resumed: boolean }> {
  const uid = await currentUserId();
  const { data: existing } = await supabase
    .from("test_sessions")
    .select("id,completed_at")
    .eq("user_id", uid)
    .eq("mock_exam_id", mockExamId)
    .is("completed_at", null)
    .order("started_at", { ascending: false })
    .limit(1);
  if (existing && existing.length > 0)
    return { sessionId: existing[0].id as string, resumed: true };

  // Prefer mock_exam_sections (tests picker); fallback to legacy per-question rows
  let ids: string[] = [];
  const { data: sections } = await supabase
    .from("mock_exam_sections")
    .select("test_id, module, section_index")
    .eq("mock_exam_id", mockExamId)
    .not("test_id", "is", null);
  if (sections && sections.length > 0) {
    const linkedIds = [...new Set(sections.map((s) => s.test_id as string))];
    const { data: linkedTests } = await supabase
      .from("tests")
      .select("id,section,module")
      .in("id", linkedIds);
    const testById = new Map(
      ((linkedTests ?? []) as { id: string; section: Section; module: number }[]).map((test) => [
        test.id,
        test,
      ]),
    );
    linkedIds.sort((a, b) => {
      const left = testById.get(a);
      const right = testById.get(b);
      const leftSection = left?.section === "reading_writing" ? 0 : 1;
      const rightSection = right?.section === "reading_writing" ? 0 : 1;
      if (leftSection !== rightSection) return leftSection - rightSection;
      return (left?.module ?? 1) - (right?.module ?? 1);
    });
    ids = await questionsForTests(linkedIds);
  }
  if (ids.length === 0) {
    const { data: mq } = await supabase
      .from("mock_exam_questions")
      .select("question_id, section, module, position")
      .eq("mock_exam_id", mockExamId)
      .order("section", { ascending: true })
      .order("module", { ascending: true })
      .order("position", { ascending: true });
    ids = (mq ?? []).map((r) => r.question_id as string);
  }
  if (ids.length === 0) throw new Error("This mock exam has no questions yet.");

  const { data: sess, error } = await supabase
    .from("test_sessions")
    .insert({
      user_id: uid,
      type: "mock",
      mock_exam_id: mockExamId,
      total_questions: ids.length,
      metadata: { question_ids: ids },
    })
    .select("id")
    .single();
  if (error) throw error;
  return { sessionId: sess.id as string, resumed: false };
}

/**
 * Scale a raw score for one section to the 200-800 SAT range.
 *
 * Mocks in this app can be shorter than a real section (54 R&W / 44 Math), so
 * the raw count is first projected onto the official question count, then run
 * through the shared conversion curve in `lib/sat`. Using that curve here keeps
 * mock results consistent with the score calculator shown in Analysis — a
 * previous linear `200 + pct * 600` version disagreed with it.
 */
export function scaledScore(
  correct: number,
  total: number,
  section: Section = "reading_writing",
): number {
  if (total <= 0) return 200;
  const official = questionCountFor(section);
  const projected = (Math.max(0, Math.min(total, correct)) / total) * official;
  return rawToScaled(section, projected);
}

export async function bumpDailyStreak(userId: string): Promise<void> {
  const today = format(new Date(), "yyyy-MM-dd");
  const { data: sp } = await supabase
    .from("student_profiles")
    .select("current_streak,longest_streak,last_daily_completed_date")
    .eq("user_id", userId)
    .maybeSingle();

  const last = sp?.last_daily_completed_date ?? null;
  if (last === today) return;

  let next = 1;
  if (last) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const yesterday = format(y, "yyyy-MM-dd");
    if (last === yesterday) next = (sp?.current_streak ?? 0) + 1;
  }
  const longest = Math.max(sp?.longest_streak ?? 0, next);
  await supabase
    .from("student_profiles")
    .update({
      current_streak: next,
      longest_streak: longest,
      last_daily_completed_date: today,
    })
    .eq("user_id", userId);
}
