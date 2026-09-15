import { describe, expect, it } from "vitest";
import { sortByScore, voteScoreDelta } from "./ranking";

describe("voteScoreDelta", () => {
  it("applies first like and dislike", () => {
    expect(voteScoreDelta(0, 1)).toBe(1);
    expect(voteScoreDelta(0, -1)).toBe(-1);
  });

  it("clears a vote back to neutral", () => {
    expect(voteScoreDelta(1, 0)).toBe(-1);
    expect(voteScoreDelta(-1, 0)).toBe(1);
  });

  it("flips like to dislike and back", () => {
    expect(voteScoreDelta(1, -1)).toBe(-2);
    expect(voteScoreDelta(-1, 1)).toBe(2);
  });

  it("is a no-op when unchanged", () => {
    expect(voteScoreDelta(1, 1)).toBe(0);
    expect(voteScoreDelta(0, 0)).toBe(0);
  });
});

describe("sortByScore", () => {
  it("orders by score desc then sort_order asc", () => {
    const sorted = sortByScore([
      { id: "a", score: 1, sort_order: 2 },
      { id: "b", score: 5, sort_order: 9 },
      { id: "c", score: 1, sort_order: 0 },
    ]);
    expect(sorted.map((v) => v.id)).toEqual(["b", "c", "a"]);
  });
});
