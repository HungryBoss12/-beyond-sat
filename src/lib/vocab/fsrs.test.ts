import { describe, expect, it } from "vitest";
import { createEmptyCard, Rating } from "ts-fsrs";
import {
  applyReview,
  emptyFsrsState,
  formatInterval,
  fromFsrsCard,
  previewIntervals,
  ratingToGrade,
  toFsrsCard,
} from "./fsrs";
import type { UserCardState } from "./types";

function seedState(overrides: Partial<UserCardState> = {}): UserCardState {
  const base = emptyFsrsState();
  return {
    id: "state-1",
    user_id: "user-1",
    card_id: "card-1",
    ...base,
    ...overrides,
  };
}

describe("vocab fsrs", () => {
  it("maps ratings to FSRS grades", () => {
    expect(ratingToGrade(1)).toBe(Rating.Again);
    expect(ratingToGrade(4)).toBe(Rating.Easy);
  });

  it("round-trips card state through FSRS card type", () => {
    const card = createEmptyCard(new Date());
    const row = fromFsrsCard(card);
    const back = toFsrsCard(seedState(row));
    expect(back.stability).toBe(card.stability);
    expect(back.state).toBe(card.state);
  });

  it("applyReview pushes due date forward on Good", () => {
    const before = seedState();
    const after = applyReview(before, 3);
    expect(new Date(after.due).getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(after.reps).toBeGreaterThanOrEqual(before.reps);
  });

  it("previewIntervals returns four labels", () => {
    const intervals = previewIntervals(seedState());
    expect(intervals[1]).toBeTruthy();
    expect(intervals[2]).toBeTruthy();
    expect(intervals[3]).toBeTruthy();
    expect(intervals[4]).toBeTruthy();
  });

  it("formatInterval shows minutes for short gaps", () => {
    const now = new Date();
    const in5m = new Date(now.getTime() + 5 * 60_000);
    expect(formatInterval(in5m, now)).toMatch(/m/);
  });
});
