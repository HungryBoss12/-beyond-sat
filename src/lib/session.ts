import { supabase } from "@/integrations/supabase/client";
import type { Section, Difficulty } from "./sat";
import { questionCountFor, rawToScaled } from "./sat";
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

export async function startPracticeSession(f: PracticeFilters): Promise<string> {
  await currentUserId();
  const { data, error } = await supabase.rpc("start_filtered_practice", {
    p_section: f.section,
    p_skill: f.skill ?? undefined,
    p_difficulty: f.difficulty ?? undefined,
    p_limit: f.limit ?? 20,
  });
  if (error) throw error;
  const sessionId = typeof data === "string" ? data : null;
  if (!sessionId) throw new Error("No questions match this filter yet.");
  return sessionId;
}

function sessionFromRpc(data: unknown): { sessionId: string; resumed: boolean } {
  const row = (Array.isArray(data) ? data[0] : data) as { id?: string; resumed?: boolean } | null;
  const sessionId = row?.id;
  if (!sessionId) throw new Error("Could not start the session.");
  return { sessionId, resumed: !!row?.resumed };
}

export async function startDailySession(): Promise<{ sessionId: string; resumed: boolean }> {
  await currentUserId();
  const { data, error } = await supabase.rpc("start_daily_session", {
    p_date: format(new Date(), "yyyy-MM-dd"),
  });
  if (error) throw error;
  return sessionFromRpc(data);
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
  await currentUserId();
  const { data, error } = await supabase.rpc("start_published_test_session", {
    p_test_id: testId,
  });
  if (error) throw error;
  return sessionFromRpc(data);
}

export async function startMockSession(
  mockExamId: string,
): Promise<{ sessionId: string; resumed: boolean }> {
  const uid = await currentUserId();
  /* Resume first: an unfinished mock keeps its server-derived question set. */
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

  /* Mocks are the only scaled (200-800) scores, so the question set is derived
     inside `start_mock_session` from mock_exam_sections/test_questions — the
     browser can no longer declare its own question list for a scaled exam. */
  const { data, error } = await supabase.rpc("start_mock_session", {
    p_mock_exam_id: mockExamId,
  });
  if (error) throw error;
  const sessionId = Array.isArray(data) ? (data[0] as string) : (data as string);
  if (!sessionId) throw new Error("This mock exam has no questions yet.");
  return { sessionId, resumed: false };
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
): number | null {
  if (total <= 0) return null;
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
