import { describe, expect, it } from "vitest";
import { buildFullPapers, suggestMockTitle, matchPaperForSection } from "./mock-exams";
import type { MockExamTest } from "./mock-exams";

const base = (over: Partial<MockExamTest>): MockExamTest => ({
  id: over.id ?? "1",
  title: over.title ?? "May 2024 · Module 1",
  section: over.section ?? "math",
  module: over.module ?? 1,
  difficulty: "B",
  source_month: over.source_month ?? 5,
  source_year: over.source_year ?? 2024,
});

describe("mock-exams", () => {
  it("buildFullPapers groups one pair per paper title", () => {
    const tests: MockExamTest[] = [
      base({ id: "m1a", title: "Nov 2024 · Module 1", module: 1 }),
      base({ id: "m2a", title: "Nov 2024 · Module 2", module: 2 }),
      base({ id: "m1b", title: "Nov 2024 · Module 1", module: 1, section: "reading_writing" }),
      base({ id: "m2b", title: "Nov 2024 · Module 2", module: 2, section: "reading_writing" }),
    ];
    const papers = buildFullPapers(tests);
    expect(papers).toHaveLength(2);
    expect(papers.map((p) => p.section).sort()).toEqual(["math", "reading_writing"]);
  });

  it("suggestMockTitle uses shared date when titles differ", () => {
    const rw = buildFullPapers([
      base({ id: "r1", section: "reading_writing", title: "DSAT Nov · Module 1", module: 1, source_month: 11, source_year: 2024 }),
      base({ id: "r2", section: "reading_writing", title: "DSAT Nov · Module 2", module: 2, source_month: 11, source_year: 2024 }),
    ])[0];
    const math = buildFullPapers([
      base({ id: "m1", title: "Nov Math · Module 1", module: 1, source_month: 11, source_year: 2024 }),
      base({ id: "m2", title: "Nov Math · Module 2", module: 2, source_month: 11, source_year: 2024 }),
    ])[0];
    expect(suggestMockTitle(rw, math)).toBe("Nov 2024 · Full Mock");
  });

  it("matchPaperForSection prefers same source date", () => {
    const anchor = buildFullPapers([
      base({ id: "r1", section: "reading_writing", module: 1, source_month: 3, source_year: 2024 }),
      base({ id: "r2", section: "reading_writing", module: 2, source_month: 3, source_year: 2024 }),
    ])[0];
    const candidates = buildFullPapers([
      base({ id: "m1", module: 1, source_month: 6, source_year: 2024 }),
      base({ id: "m2", module: 2, source_month: 6, source_year: 2024 }),
      base({ id: "m3", module: 1, source_month: 3, source_year: 2024 }),
      base({ id: "m4", module: 2, source_month: 3, source_year: 2024 }),
    ]);
    const matched = matchPaperForSection(anchor, candidates, "math");
    expect(matched?.module1.id).toBe("m3");
  });
});
