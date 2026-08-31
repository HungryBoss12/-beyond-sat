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

const TRACKED_TYPES = new Set<MockSessionRow["type"]>(["mock", "practice", "daily"]);

function isTrackedSession(session: MockSessionRow): boolean {
  return TRACKED_TYPES.has(session.type);
}

function sessionWhen(session: MockSessionRow): string {
  return session.completed_at ?? session.started_at;
}

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

export function countDraftProgress(drafts: AnswerState[] | null | undefined): number {
  if (!drafts?.length) return 0;
  return drafts.filter(
    (a) => !!a.selectedChoiceId || a.gridAnswer.trim().length > 0 || a.markedForReview,
  ).length;
}

/** Completion % for a practice set — 100 when done, answered/total when in progress. */
export function practiceSetProgressPct(
  completed: boolean,
  totalQuestions: number,
  draftAnswers: AnswerState[] | null | undefined,
): number {
  if (completed) return 100;
  if (totalQuestions <= 0) return 0;
  const answered = countDraftProgress(draftAnswers);
  return Math.min(100, Math.round((answered / totalQuestions) * 100));
}

/** Project accuracy onto the 400–1600 band for practice/daily sets. */
function projectedScore(correct: number, total: number): number {
  if (total <= 0) return 400;
  return Math.round(400 + (correct / total) * 1200);
}

function resolveCompletedScore(session: MockSessionRow): number | null {
  const total = session.total_questions ?? 0;

  if (session.type === "mock") {
    if (session.rw_score != null && session.math_score != null) {
      return session.rw_score + session.math_score;
    }
    if (session.score != null && Number.isFinite(Number(session.score))) {
      const scaled = Math.round(Number(session.score));
      if (scaled >= 400) return scaled;
    }
  }

  if (session.completed_at && session.correct_count != null && total > 0) {
    return projectedScore(session.correct_count, total);
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

/** Best available display score — SAT scale for mocks, projected band for practice/daily. */
export function mockDisplayScore(session: MockSessionRow): MockTrendPoint | null {
  if (!isTrackedSession(session)) return null;

  const when = sessionWhen(session);
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
    return {
      id: session.id,
      label: format(new Date(when), "MMM d"),
      score: projectedScore(answered, total),
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
  return sessions.filter((s) => isTrackedSession(s) && mockHasActivity(s)).length;
}

export function buildMockTrend(sessions: MockSessionRow[], limit = 8): MockTrendPoint[] {
  const tracked = sessions
    .filter(isTrackedSession)
    .slice()
    .sort(
      (a, b) => new Date(sessionWhen(a)).getTime() - new Date(sessionWhen(b)).getTime(),
    );

  const usedLabels = new Map<string, number>();
  const points: MockTrendPoint[] = [];
  for (const m of tracked) {
    const pt = mockDisplayScore(m);
    if (!pt) continue;
    const when = sessionWhen(m);
    points.push({
      ...pt,
      label: trendLabel(when, m.id, usedLabels),
    });
  }
  return points.slice(-limit);
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

export function completedSessionScore(session: MockSessionRow): number | null {
  if (!session.completed_at) return null;
  return resolveCompletedScore(session);
}

export function latestMockSummary(sessions: MockSessionRow[]) {
  const tracked = sessions.filter(isTrackedSession);
  const completed = tracked
    .filter((m) => m.completed_at && resolveCompletedScore(m) != null)
    .sort(
      (a, b) =>
        new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime(),
    );

  const mockCompleted = completed.filter((m) => m.type === "mock");
  const pool = mockCompleted.length > 0 ? mockCompleted : completed;

  if (pool.length > 0) {
    const [current, previous] = pool;
    const currentScore = resolveCompletedScore(current)!;
    const previousScore = previous ? resolveCompletedScore(previous) : null;
    return {
      score: currentScore,
      rw: current.type === "mock" ? current.rw_score : null,
      math: current.type === "mock" ? current.math_score : null,
      delta: previousScore != null ? currentScore - previousScore : null,
      at: current.completed_at,
      incomplete: false as const,
      progressPct: null as number | null,
    };
  }

  const inProgress = tracked.find((m) => mockDisplayScore(m)?.incomplete);
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
