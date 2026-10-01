import { describe, expect, it } from "vitest";
import { prorateJoinMonth } from "./proration";

describe("prorateJoinMonth", () => {
  it("charges 5 of 13 lessons to the nearest 1 000", () => {
    expect(prorateJoinMonth(1300000n, 5, 13)).toEqual({
      amount: 500000n,
      lessons: { remaining: 5, total: 13 },
    });
  });

  it("charges the full fee when every lesson remains", () => {
    expect(prorateJoinMonth(1300000n, 13, 13)).toEqual({ amount: 1300000n, lessons: null });
  });

  it("charges nothing when no lesson remains", () => {
    expect(prorateJoinMonth(1300000n, 0, 13).amount).toBe(0n);
  });

  it("charges the full fee when the month has no lessons", () => {
    expect(prorateJoinMonth(1300000n, 0, 0)).toEqual({ amount: 1300000n, lessons: null });
  });

  it("rounds half-up to the nearest 1 000", () => {
    expect(prorateJoinMonth(1000000n, 10, 14).amount).toBe(714000n);
    expect(prorateJoinMonth(1000n, 1, 2).amount).toBe(1000n);
    expect(prorateJoinMonth(1100000n, 1, 13).amount).toBe(85000n);
    expect(prorateJoinMonth(13000n, 1, 26).amount).toBe(1000n);
  });

  it("is zero for an unpriced group", () => {
    expect(prorateJoinMonth(0n, 5, 13).amount).toBe(0n);
  });
});
