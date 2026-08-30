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
  id: string;
  label: string;
  score: number;
  incomplete: boolean;
  progressPct: number | null;
  /** Synthetic anchor point so Recharts draws a line when only one mock exists. */
  anchor?: boolean;
};

function parseMetadata(session: MockSessionRow): MockSessionRow["metadata"] {
  const raw = session.metadata;
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as MockSessionRow["metadata"];
    } catch {
      return null;
    }
  }
  return raw;
}

function countDraftProgress(drafts: AnswerState[] | null | undefined): number {
  if (!drafts?.length) return 0;
  return drafts.filter(
    (a) => !!a.selectedChoiceId || a.gridAnswer.trim().length > 0 || a.markedForReview,
  ).length;
}

function resolveCompletedScore(session: MockSessionRow): number | null {
  if (session.score != null && Number.isFinite(Number(session.score))) {
    return Math.round(Number(session.score));
  }
  if (session.rw_score != null && session.math_score != null) {
    return session.rw_score + session.math_score;
  }
  const total = session.total_questions ?? 0;
  if (session.completed_at && session.correct_count != null && total > 0) {
    return Math.round(400 + (session.correct_count / total) * 1200);
  }
  return null;
}

function trendLabel(when: string, sessionId: string, usedLabels: Map<string, number>): string {
  const base = format(new Date(when), "MMM d");
  const count = usedLabels.get(base) ?? 0;
  usedLabels.set(base, count + 1);
  if (count === 0) return base;
  return `${base} · ${sessionId.slice(0, 4)}`;
}

/** Best available display score for a mock — real score when finished, else progress band. */
export function mockDisplayScore(session: MockSessionRow): MockTrendPoint | null {
  if (session.type !== "mock") return null;

  const when = session.completed_at ?? session.started_at;
  const completedScore = resolveCompletedScore(session);

  if (session.completed_at && completedScore != null) {
    return {
      id: session.id,
      label: format(new Date(when), "MMM d"),
      score: completedScore,
      incomplete: false,
      progressPct: null,
    };
  }

  const total = session.total_questions ?? 0;
  if (total <= 0) return null;

  const answered = countDraftProgress(parseMetadata(session)?.draft_answers);
  if (answered > 0) {
    const progressPct = Math.round((answered / total) * 100);
    const score = Math.round(400 + (answered / total) * 1200);
    return {
      id: session.id,
      label: format(new Date(when), "MMM d"),
      score,
      incomplete: true,
      progressPct,
    };
  }

  if (!session.completed_at) {
    return {
      id: session.id,
      label: format(new Date(when), "MMM d"),
      score: 400,
      incomplete: true,
      progressPct: 0,
    };
  }

  return null;
}

export function mockHasActivity(session: MockSessionRow): boolean {
  return mockDisplayScore(session) != null;
}

export function countMockTestsTaken(sessions: MockSessionRow[]): number {
  return sessions.filter((s) => s.type === "mock" && mockHasActivity(s)).length;
}

export function buildMockTrend(sessions: MockSessionRow[], limit = 8): MockTrendPoint[] {
  const mocks = sessions.filter((s) => s.type === "mock");
  const usedLabels = new Map<string, number>();
  const points: MockTrendPoint[] = [];
  for (const m of mocks) {
    const pt = mockDisplayScore(m);
    if (!pt) continue;
    const when = m.completed_at ?? m.started_at;
    points.push({
      ...pt,
      label: trendLabel(when, m.id, usedLabels),
    });
  }
  return points.slice().reverse().slice(-limit);
}

/** Recharts Area needs at least two X positions to draw a visible segment. */
export function chartReadyTrend(points: MockTrendPoint[]): MockTrendPoint[] {
  if (points.length === 0) return [];
  if (points.length === 1) {
    const p = points[0];
    return [
      {
        id: `${p.id}-anchor`,
        label: " ",
        score: 400,
        incomplete: true,
        progressPct: 0,
        anchor: true,
      },
      p,
    ];
  }
  return points;
}

export function latestMockSummary(sessions: MockSessionRow[]) {
  const mocks = sessions.filter((s) => s.type === "mock");
  const scored = mocks.filter((m) => resolveCompletedScore(m) != null && m.completed_at);
  if (scored.length > 0) {
    const [current, previous] = scored;
    const currentScore = resolveCompletedScore(current)!;
    const previousScore = previous ? resolveCompletedScore(previous) : null;
    return {
      score: currentScore,
      rw: current.rw_score,
      math: current.math_score,
      delta: previousScore != null ? currentScore - previousScore : null,
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
