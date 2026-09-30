import { describe, expect, it } from "vitest";
import { clampScore, compareRanked, rankFor, totalScore, type RankedStudent } from "./ranking";

describe("ranking", () => {
  it("maps totals onto S through D at the boundaries", () => {
    expect(rankFor(totalScore(700, 800)).letter).toBe("S");
    expect(rankFor(1500).letter).toBe("S");
    expect(rankFor(1499).letter).toBe("A");
    expect(rankFor(1400).letter).toBe("A");
    expect(rankFor(1399).letter).toBe("B");
    expect(rankFor(1300).letter).toBe("B");
    expect(rankFor(1299).letter).toBe("C");
    expect(rankFor(1200).letter).toBe("C");
    expect(rankFor(1199).letter).toBe("D");
    expect(rankFor(1199).legend).toBe("Not enough");
  });

  it("clamps section scores onto 200–800", () => {
    expect(clampScore(150)).toBe(200);
    expect(clampScore(850)).toBe(800);
    expect(clampScore(655.4)).toBe(655);
    expect(clampScore("abc")).toBeNull();
  });

  it("sorts by total, then math, then name, and shares places", () => {
    const rows: RankedStudent[] = [
      { name: "B", rw: 600, math: 700, total: 1300 },
      { name: "A", rw: 700, math: 600, total: 1300 },
      { name: "C", rw: 800, math: 700, total: 1500 },
    ];
    const sorted = [...rows].sort(compareRanked);
    expect(sorted.map((r) => r.name)).toEqual(["C", "B", "A"]);
  });
});
