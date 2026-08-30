import { describe, expect, it } from "vitest";
import {
  buildMockTrend,
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
});
