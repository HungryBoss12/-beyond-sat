import { describe, expect, it } from "vitest";
import { levelOverall, levelTrend, parseLevelScore, sectionShort, stepLevel } from "./level";

describe("levelOverall", () => {
  it("averages two sections", () => {
    expect(levelOverall([{ score: 400 }, { score: 1000 }])).toBe(700);
  });

  it("rounds half-up", () => {
    expect(levelOverall([{ score: 455 }, { score: 456 }])).toBe(456);
  });

  it("ignores blank sections", () => {
    expect(levelOverall([{ score: 600 }, { score: null }, { score: undefined }, { score: 700 }])).toBe(650);
  });

  it("uses a single section as-is", () => {
    expect(levelOverall([{ score: 640 }])).toBe(640);
  });

  it("is null when nothing is scored", () => {
    expect(levelOverall([{ score: null }, { score: null }])).toBeNull();
    expect(levelOverall([])).toBeNull();
  });

  it("rejects out-of-range and non-integer scores", () => {
    expect(() => levelOverall([{ score: 399 }])).toThrow(RangeError);
    expect(() => levelOverall([{ score: 1001 }])).toThrow(RangeError);
    expect(() => levelOverall([{ score: 650.5 }])).toThrow(RangeError);
    expect(() => levelOverall([{ score: "abc" as unknown as number }])).toThrow(RangeError);
  });

  it("weights sections once weights differ from 1", () => {
    expect(levelOverall([{ score: 400, weight: 3 }, { score: 1000, weight: 1 }])).toBe(550);
  });
});

describe("parseLevelScore", () => {
  it("accepts whole numbers in range and blanks", () => {
    expect(parseLevelScore("640")).toEqual({ kind: "ok", value: 640 });
    expect(parseLevelScore(" ")).toEqual({ kind: "empty" });
  });

  it("rejects everything else without clamping", () => {
    expect(parseLevelScore("399").kind).toBe("error");
    expect(parseLevelScore("1001").kind).toBe("error");
    expect(parseLevelScore("650.5").kind).toBe("error");
    expect(parseLevelScore("abc").kind).toBe("error");
  });
});

describe("level helpers", () => {
  it("steps by 10, or 50 with Shift, inside the range", () => {
    expect(stepLevel(640, 1, false)).toBe(650);
    expect(stepLevel(640, -1, true)).toBe(590);
    expect(stepLevel(995, 1, false)).toBe(1000);
    expect(stepLevel(null, 1, false)).toBe(400);
  });

  it("abbreviates section names for column headers", () => {
    expect(sectionShort("Command of Evidence (Textual)")).toBe("CET");
    expect(sectionShort("Similarity & Congruence")).toBe("SC");
    expect(sectionShort("Systems")).toBe("Syste");
  });

  it("compares with the previous assessment", () => {
    expect(levelTrend(660, 640)).toBe("up");
    expect(levelTrend(600, 640)).toBe("down");
    expect(levelTrend(640, 640)).toBe("flat");
    expect(levelTrend(640, null)).toBeNull();
  });
});
