import { describe, expect, it } from "vitest";
import { applyAnswerKey, parseAnswerKey } from "./answer-key";
import type { Draft } from "./parse";

function drafts(count: number, opts: { from?: number; module?: "1" | "2" } = {}): Draft[] {
  const from = opts.from ?? 1;
  return Array.from({ length: count }, (_, i) => ({
    number: from + i,
    rec: { kind: "grid_in", correct: "", module: opts.module ?? "1" },
    warnings: [],
  }));
}

function answers(list: Draft[]): string[] {
  return list.map((d) => d.rec.correct);
}

describe("unnumbered runs holding open answers", () => {
  it("reads grid-in values as answers, not as question numbers", () => {
    const key = parseAnswerKey("B 15 A 3/4 D 0.5");
    expect(key.entries.map((e) => e.value)).toEqual(["B", "15", "A", "3/4", "D", "0.5"]);
    expect(key.entries.every((e) => e.positional)).toBe(true);
  });

  it("reads a run made only of open answers", () => {
    const key = parseAnswerKey("15\n3/4\n0.75\n12");
    expect(key.entries.map((e) => e.value)).toEqual(["15", "3/4", "0.75", "12"]);
  });

  it("fills every question from a mixed run", () => {
    const out = applyAnswerKey(drafts(4), parseAnswerKey("B 15 A 3/4"));
    expect(answers(out.drafts)).toEqual(["B", "15", "A", "3/4"]);
    expect(out.filled).toBe(4);
  });

  it("keeps `3 / 4` as one answer", () => {
    const key = parseAnswerKey("A 3 / 4 B");
    expect(key.entries.map((e) => e.value)).toEqual(["A", "3/4", "B"]);
  });

  it("accepts decimals without a leading zero and negatives", () => {
    const key = parseAnswerKey(".5 -4 +2");
    expect(key.entries.map((e) => e.value)).toEqual([".5", "-4", "+2"]);
  });

  it("reports a token it cannot read instead of shifting later answers", () => {
    const key = parseAnswerKey("A ??? B");
    expect(key.entries.map((e) => e.value)).toEqual(["A", "B"]);
    expect(key.unparsed).toContain("???");
  });
});

describe("numbered keys still win when numbering is present", () => {
  it("reads punctuated numbering with open answers", () => {
    const key = parseAnswerKey("1. 3/4\n2. 0.5\n3. B");
    expect(key.entries).toEqual([
      { number: 1, value: "3/4" },
      { number: 2, value: "0.5" },
      { number: 3, value: "B" },
    ]);
  });

  it("reads space-separated numbering that counts up", () => {
    const key = parseAnswerKey("1 A 2 D 3 C");
    expect(key.entries.map((e) => [e.number, e.value])).toEqual([
      [1, "A"],
      [2, "D"],
      [3, "C"],
    ]);
  });

  it("does not mistake two grid-in answers for a numbered pair", () => {
    const key = parseAnswerKey("12 15");
    expect(key.entries.map((e) => e.value)).toEqual(["12", "15"]);
  });
});

describe("positional application", () => {
  it("fills a paper whose numbering does not start at 1", () => {
    const out = applyAnswerKey(drafts(3, { from: 12 }), parseAnswerKey("A 3/4 C"));
    expect(answers(out.drafts)).toEqual(["A", "3/4", "C"]);
    expect(out.unmatched).toEqual([]);
  });

  it("counts answers left over past the last question", () => {
    const out = applyAnswerKey(drafts(2), parseAnswerKey("A B C D"));
    expect(out.filled).toBe(2);
    expect(out.extra).toBe(2);
  });

  it("keeps each module's run inside that module", () => {
    const list = [...drafts(2, { module: "1" }), ...drafts(2, { module: "2" })];
    const out = applyAnswerKey(list, parseAnswerKey("Module 1: A B\nModule 2: 3/4 12"));
    expect(answers(out.drafts)).toEqual(["A", "B", "3/4", "12"]);
  });
});
