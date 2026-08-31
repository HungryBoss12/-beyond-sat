import { describe, expect, it } from "vitest";
import { blocksToDrafts, extractChoicesFromTableBlock, splitInlineChoices } from "./parse";

const defaults = {
  section: "math" as const,
  skill: "Algebra",
  difficulty: "medium",
  source_month: "6",
  source_year: "2025",
};

describe("extractChoicesFromTableBlock", () => {
  it("reads A–D from a markdown table", () => {
    const block = [
      "| A) 12 | B) 13 |",
      "| --- | --- |",
      "| C) 14 | D) 15 |",
    ].join("\n");
    const choices = extractChoicesFromTableBlock(block);
    expect(choices?.map((c) => c.id)).toEqual(["A", "B", "C", "D"]);
    expect(choices?.[0].text).toBe("12");
  });
});

describe("blocksToDrafts math", () => {
  it("detects choices laid out in a table block", () => {
    const out = blocksToDrafts(
      [
        "1. What is 2 + 2?",
        "| A) 3 | B) 4 |",
        "| --- | --- |",
        "| C) 5 | D) 6 |",
      ],
      defaults,
    );
    expect(out.drafts).toHaveLength(1);
    expect(out.drafts[0].rec.kind).toBe("multiple_choice");
    expect(out.drafts[0].rec.choice_A).toBe("3");
    expect(out.drafts[0].rec.choice_D).toBe("6");
  });

  it("does not treat missing choices as multiple choice", () => {
    const out = blocksToDrafts(["1. Enter the value of x."], defaults);
    expect(out.drafts[0].rec.kind).toBe("grid_in");
  });
});

describe("splitInlineChoices", () => {
  it("keeps strict A→B order", () => {
    expect(splitInlineChoices("A) one  B) two  C) three"))?.toHaveLength(3);
  });
});
