import { format } from "date-fns";
import type { AnswerState } from "@/components/QuestionCard";

export type MockSessionRow = {
  id: string;
  type: "practice" | "daily" | "mock";
  score: number | null;
  rw_score: number | null;
  math_score: number | null;
  completed_at: string | null;
  started_at: string;
  total_questions: number | null;
  correct_count: number | null;
  metadata: { draft_answers?: AnswerState[] | null } | null;
};

export type MockTrendPoint = {
  label: string;
  score: number;
  incomplete: boolean;
  progressPct: number | null;
};

function countDraftProgress(drafts: AnswerState[] | null | undefined): number {
  if (!drafts?.length) return 0;
  return drafts.filter(
    (a) => !!a.selectedChoiceId || a.gridAnswer.trim().length > 0 || a.markedForReview,
  ).length;
}

/** Best available display score for a mock — real score when finished, else progress band. */
export function mockDisplayScore(session: MockSessionRow): MockTrendPoint | null {
  if (session.type !== "mock") return null;

  const when = session.completed_at ?? session.started_at;
  const label = format(new Date(when), "MMM d");

  if (session.score != null) {
    return { label, score: session.score, incomplete: false, progressPct: null };
  }

  const total = session.total_questions ?? 0;
  if (total <= 0) return null;

  const answered = countDraftProgress(session.metadata?.draft_answers);
  if (answered <= 0) return null;

  const progressPct = Math.round((answered / total) * 100);
  // Progress band on the 400–1600 scale — not a graded score, but charts activity.
  const score = Math.round(400 + (answered / total) * 1200);
  return { label, score, incomplete: true, progressPct };
}

export function mockHasActivity(session: MockSessionRow): boolean {
  return mockDisplayScore(session) != null;
}

export function buildMockTrend(sessions: MockSessionRow[], limit = 8): MockTrendPoint[] {
  const mocks = sessions.filter((s) => s.type === "mock");
  const points: MockTrendPoint[] = [];
  for (const m of mocks) {
    const pt = mockDisplayScore(m);
    if (pt) points.push(pt);
  }
  return points.slice().reverse().slice(-limit);
}

export function latestMockSummary(sessions: MockSessionRow[]) {
  const mocks = sessions.filter((s) => s.type === "mock");
  const scored = mocks.filter((m) => m.score != null) as (MockSessionRow & { score: number })[];
  if (scored.length > 0) {
    const [current, previous] = scored;
    return {
      score: current.score,
      rw: current.rw_score,
      math: current.math_score,
      delta: previous?.score != null ? current.score - previous.score : null,
      at: current.completed_at,
      incomplete: false as const,
      progressPct: null as number | null,
    };
  }

  const inProgress = mocks.find((m) => mockDisplayScore(m)?.incomplete);
  const pt = inProgress ? mockDisplayScore(inProgress) : null;
  if (!pt) return null;

  return {
    score: pt.score,
    rw: null,
    math: null,
    delta: null,
    at: inProgress!.started_at,
    incomplete: true as const,
    progressPct: pt.progressPct,
  };
}
