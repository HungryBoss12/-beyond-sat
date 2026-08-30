import { describe, expect, it } from "vitest";
import {
  buildMockTrend,
  chartReadyTrend,
  countMockTestsTaken,
  latestMockSummary,
  mockDisplayScore,
  type MockSessionRow,
} from "./dashboard-mocks";

const base: MockSessionRow = {
  id: "1",
  type: "mock",
  score: null,
  rw_score: null,
  math_score: null,
  completed_at: null,
  started_at: "2026-08-01T10:00:00Z",
  total_questions: 98,
  correct_count: null,
  metadata: { draft_answers: [{ selectedChoiceId: "a", gridAnswer: "", markedForReview: false }] },
};

describe("dashboard-mocks", () => {
  it("charts incomplete mock progress from draft answers", () => {
    const pt = mockDisplayScore(base);
    expect(pt?.incomplete).toBe(true);
    expect(pt?.score).toBeGreaterThan(400);
  });

  it("charts started mock with no answers at baseline", () => {
    const started: MockSessionRow = {
      ...base,
      metadata: { draft_answers: null },
    };
    const pt = mockDisplayScore(started);
    expect(pt?.score).toBe(400);
    expect(pt?.progressPct).toBe(0);
  });

  it("uses rw+math when total score is missing", () => {
    const completed: MockSessionRow = {
      ...base,
      id: "2",
      score: null,
      rw_score: 640,
      math_score: 660,
      completed_at: "2026-08-02T10:00:00Z",
      metadata: { draft_answers: null },
    };
    expect(mockDisplayScore(completed)?.score).toBe(1300);
  });

  it("buildMockTrend includes incomplete and completed mocks", () => {
    const completed: MockSessionRow = {
      ...base,
      id: "2",
      score: 1200,
      completed_at: "2026-08-02T10:00:00Z",
      metadata: { draft_answers: null },
    };
    const trend = buildMockTrend([base, completed]);
    expect(trend).toHaveLength(2);
    expect(trend.some((t) => t.incomplete)).toBe(true);
  });

  it("chartReadyTrend adds anchor for single-point charts", () => {
    const trend = buildMockTrend([
      {
        ...base,
        id: "2",
        score: 1180,
        completed_at: "2026-08-02T10:00:00Z",
        metadata: { draft_answers: null },
      },
    ]);
    const chart = chartReadyTrend(trend);
    expect(chart).toHaveLength(2);
    expect(chart[0].anchor).toBe(true);
    expect(chart[1].score).toBe(1180);
  });

  it("latestMockSummary prefers completed score over in-progress", () => {
    const completed: MockSessionRow = {
      ...base,
      id: "2",
      score: 1300,
      rw_score: 650,
      math_score: 650,
      completed_at: "2026-08-02T10:00:00Z",
    };
    const summary = latestMockSummary([base, completed]);
    expect(summary?.score).toBe(1300);
    expect(summary?.incomplete).toBe(false);
  });

  it("latestMockSummary falls back to in-progress mock", () => {
    const summary = latestMockSummary([base]);
    expect(summary?.incomplete).toBe(true);
    expect(summary?.progressPct).toBeGreaterThan(0);
  });

  it("countMockTestsTaken includes incomplete and completed mocks", () => {
    const completed: MockSessionRow = {
      ...base,
      id: "2",
      score: 1200,
      completed_at: "2026-08-02T10:00:00Z",
      metadata: { draft_answers: null },
    };
    const started: MockSessionRow = {
      ...base,
      id: "3",
      metadata: { draft_answers: null },
    };
    expect(countMockTestsTaken([base, completed])).toBe(2);
    expect(countMockTestsTaken([started])).toBe(1);
  });
});
