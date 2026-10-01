import { describe, expect, it } from "vitest";
import { doneSummary, itemsFor, schemeFor, slugToSubject } from "./schemes";
import { parseModule, resultLabel } from "./results";

describe("results", () => {
  it("rejects a module above 27", () => {
    expect(parseModule("28").kind).toBe("error");
    expect(parseModule("27")).toEqual({ kind: "ok", value: 27 });
    expect(parseModule("-1").kind).toBe("error");
    expect(parseModule("").kind).toBe("empty");
  });

  it("shows N.A. below 30 and the score from 30", () => {
    expect(resultLabel(14, 15)).toBe("N.A.");
    expect(resultLabel(15, 15)).toBe("30");
    expect(resultLabel(15, null)).toBe("—");
  });
});

describe("schemes", () => {
  it("maps Maths to AFL and Eng to VAR", () => {
    expect(schemeFor("math")).toBe("AFL");
    expect(itemsFor("math")).toEqual(["assignment", "formulas"]);
    expect(itemsFor("ebrw")).toEqual(["vocab", "assignment", "article"]);
    expect(slugToSubject("eng")).toBe("ebrw");
    expect(slugToSubject("ebrw")).toBeNull();
  });

  it("writes the footer summary per scheme", () => {
    expect(doneSummary("ebrw", { vocab: 4, assignment: 6, article: 2 })).toBe(
      "Done: 4 vocab · 6 assign · 2 article",
    );
    expect(doneSummary("math", { assignment: 5, formulas: 3 }, 640)).toBe(
      "Done: 5 assign · 3 formulas · avg L 640",
    );
  });
});
