import { supabase } from "@/integrations/supabase/client";

/**
 * The student's own numbers, formatted for the AI's first message.
 *
 * Sent as part of the user turn rather than as a system instruction, because the
 * system prompt is assembled server-side and must stay out of the client's
 * reach — otherwise anything here could override the guardrails.
 *
 * Lived in analysis.tsx until the chat moved to its own section; it is kept
 * because it is what makes the first reply specific to the student rather than
 * generic advice.
 */

export type ScoreContext = {
  latest: number;
  average: number;
  best: number;
  count: number;
  rw: number;
  math: number;
};

export type TotalsContext = { correct: number; wrong: number; total: number };

export function buildAiContext(scores: ScoreContext, totals: TotalsContext): string {
  if (scores.count === 0 && totals.total === 0) {
    return "Context: I haven't completed any practice questions or mock exams yet.";
  }
  const parts: string[] = [];
  if (scores.count > 0) {
    parts.push(
      `latest mock score ${scores.latest}/1600 across ${scores.count} mock${scores.count === 1 ? "" : "s"}`,
      `average ${scores.average}, best ${scores.best}`,
    );
    if (scores.rw || scores.math) {
      parts.push(
        `average Reading & Writing ${scores.rw || "n/a"}, average Math ${scores.math || "n/a"}`,
      );
    }
  }
  if (totals.total > 0) {
    const pct = Math.round((totals.correct / totals.total) * 100);
    parts.push(`${totals.correct} of ${totals.total} practice questions correct (${pct}%)`);
  }
  return `Context about me — ${parts.join("; ")}. Use these numbers when they're relevant and don't ask me to repeat them.`;
}

/**
 * Loads the same numbers the analysis page shows, for the chat page which has no
 * charts of its own. Deliberately tolerant: a failed read means a slightly less
 * personal first reply, not a broken chat, so callers get `null` rather than a
 * thrown error.
 */
export async function loadAiContext(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from("test_sessions")
      .select("score, rw_score, math_score, correct_count, total_questions, completed_at")
      .order("completed_at", { ascending: false });
    if (error) return null;

    const rows = (data ?? []) as {
      score: number | null;
      rw_score: number | null;
      math_score: number | null;
      correct_count: number | null;
      total_questions: number | null;
      completed_at: string | null;
    }[];
    const done = rows.filter((r) => r.completed_at);
    const scored = done.filter((r) => typeof r.score === "number" && r.score! > 0);
    const avg = (nums: number[]) =>
      nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : 0;

    const correct = done.reduce((sum, r) => sum + (r.correct_count ?? 0), 0);
    const total = done.reduce((sum, r) => sum + (r.total_questions ?? 0), 0);

    return buildAiContext(
      {
        latest: scored[0]?.score ?? 0,
        average: avg(scored.map((r) => r.score!)),
        best: scored.length ? Math.max(...scored.map((r) => r.score!)) : 0,
        count: scored.length,
        rw: avg(scored.map((r) => r.rw_score ?? 0).filter(Boolean)),
        math: avg(scored.map((r) => r.math_score ?? 0).filter(Boolean)),
      },
      { correct, wrong: total - correct, total },
    );
  } catch {
    return null;
  }
}
