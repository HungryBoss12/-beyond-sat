import { describe, expect, it } from "vitest";
import { initials, leadingScore, parseHallOfFame } from "./schema";

describe("parseHallOfFame", () => {
  it("returns an empty model for an empty row", () => {
    const m = parseHallOfFame({});
    expect(m.top).toBeNull();
    expect(m.tiles).toEqual([]);
    expect(m.quote).toBeNull();
    expect(m.report).toBeNull();
    expect(m.stories).toEqual([]);
    expect(m.ctaHref).toBe("/signup");
  });

  it("drops tiles with an out-of-range or missing score and keeps the rest", () => {
    const m = parseHallOfFame({
      tiles: [
        { name: "A", score: 1590 },
        { name: "B", score: 2400 },
        { name: "C", score: "abc" },
        { name: "", score: 1500 },
        { name: "D", score: "1540" },
        null,
        "junk",
      ],
    });
    expect(m.tiles.map((t) => [t.name, t.score])).toEqual([
      ["A", 1590],
      ["D", 1540],
    ]);
  });

  it("uses the explicit top card, and otherwise the best tile", () => {
    const tiles = [
      { name: "A", score: 1500 },
      { name: "B", score: 1580 },
    ];
    expect(parseHallOfFame({ tiles }).top?.name).toBe("B");
    const explicit = parseHallOfFame({
      tiles,
      top: { name: "Z", score: 1600, caption: "10,000+ students" },
    });
    expect(explicit.top).toMatchObject({ name: "Z", score: 1600, caption: "10,000+ students" });
  });

  it("caps text length and tile count", () => {
    const m = parseHallOfFame({
      tiles: Array.from({ length: 80 }, (_, i) => ({ name: "x".repeat(300), score: 1000 + i })),
    });
    expect(m.tiles).toHaveLength(24);
    expect(m.tiles[0].name).toHaveLength(60);
  });

  it("needs both section scores for the score report", () => {
    expect(parseHallOfFame({ report: { reading_writing: 790 } }).report).toBeNull();
    expect(
      parseHallOfFame({ report: { reading_writing: 790, math: 800, name: "N" } }).report,
    ).toMatchObject({
      readingWriting: 790,
      math: 800,
      name: "N",
    });
  });

  it("drops unsafe photo URLs", () => {
    const m = parseHallOfFame({
      tiles: [{ name: "A", score: 1500, photo: "javascript:alert(1)" }],
    });
    expect(m.tiles[0].photo).toBe("");
  });

  it("keeps an old-format review row rendering as stories and tiles", () => {
    const m = parseHallOfFame({
      title: "Students who got there",
      items: [
        {
          stars: 5,
          quote: "Great.",
          name: "Student name",
          detail: "1520 · +180 points",
          avatar: "",
        },
        { stars: 5, quote: "Also great.", name: "Other", detail: "+120 points", avatar: "" },
      ],
    });
    expect(m.stories).toHaveLength(2);
    expect(m.stories[0].score).toBe(1520);
    expect(m.stories[1].score).toBeUndefined();
    expect(m.tiles.map((t) => t.score)).toEqual([1520]);
    expect(m.top?.score).toBe(1520);
  });
});

describe("leadingScore", () => {
  it("reads a score at the start only", () => {
    expect(leadingScore("1520 · +180 points")).toBe(1520);
    expect(leadingScore("+420 points")).toBeUndefined();
    expect(leadingScore("180 points")).toBeUndefined();
    expect(leadingScore("2000")).toBeUndefined();
  });
});

describe("initials", () => {
  it("returns up to two letters", () => {
    expect(initials("Ansor Khasanov Jr")).toBe("AK");
    expect(initials("")).toBe("");
  });
});
