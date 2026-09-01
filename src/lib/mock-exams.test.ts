import { describe, expect, it } from "vitest";
import {
  buildFullPapers,
  collectUsedTestIds,
  compareBySourceDateAndSection,
  filterPapersForMockPicker,
  groupByPaperDate,
  suggestMockTitle,
  matchPaperForSection,
} from "./mock-exams";
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

  it("matchPaperForSection prefers same source date", () => {
    const anchor = buildFullPapers([
      base({ id: "r1", section: "reading_writing", title: "March 2024 · Module 1", module: 1, source_month: 3, source_year: 2024 }),
      base({ id: "r2", section: "reading_writing", title: "March 2024 · Module 2", module: 2, source_month: 3, source_year: 2024 }),
    ])[0];
    const candidates = buildFullPapers([
      base({ id: "m1", title: "June 2024 · Module 1", module: 1, source_month: 6, source_year: 2024 }),
      base({ id: "m2", title: "June 2024 · Module 2", module: 2, source_month: 6, source_year: 2024 }),
      base({ id: "m3", title: "March 2024 · Module 1", module: 1, source_month: 3, source_year: 2024 }),
      base({ id: "m4", title: "March 2024 · Module 2", module: 2, source_month: 3, source_year: 2024 }),
    ]);
    const matched = matchPaperForSection(anchor, candidates, "math");
    expect(matched?.module1.id).toBe("m3");
  });

  it("compareBySourceDateAndSection orders EBRW before Math at the same date", () => {
    const rw = base({
      id: "r1",
      section: "reading_writing",
      title: "Nov 2024 · Module 1",
      source_month: 11,
      source_year: 2024,
    });
    const math = base({
      id: "m1",
      title: "Nov 2024 · Module 1",
      source_month: 11,
      source_year: 2024,
    });
    expect(compareBySourceDateAndSection(rw, math)).toBeLessThan(0);
  });

  it("groupByPaperDate keeps all undated papers in one bottom section", () => {
    const items = [
      {
        source_month: 11,
        source_year: 2024,
        section: "math" as const,
        title: "Nov 2024",
      },
      {
        source_month: null,
        source_year: 2024,
        section: "math" as const,
        title: "Mystery Paper",
      },
      {
        source_month: null,
        source_year: null,
        section: "reading_writing" as const,
        title: "No Date Paper",
      },
    ];
    const groups = groupByPaperDate(items);
    expect(groups.map((g) => g.label)).toEqual(["November 2024", "2024", "Undated"]);
    expect(groups[2].items).toHaveLength(1);
    expect(groups.find((g) => g.label === "Undated")?.items[0].title).toBe("No Date Paper");
  });

  it("groupByPaperDate parses dates from titles when source fields are empty", () => {
    const groups = groupByPaperDate([
      {
        source_month: null,
        source_year: null,
        section: "math" as const,
        title: "DSAT November 2024",
      },
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe("November 2024");
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
    expect(suggestMockTitle(rw, math)).toBe("November 2024 · Full Mock");
  });

  it("collectUsedTestIds skips the mock being edited", () => {
    const ids = collectUsedTestIds(
      [
        { mock_exam_id: "mock-a", test_id: "t1" },
        { mock_exam_id: "mock-a", test_id: "t2" },
        { mock_exam_id: "mock-b", test_id: "t3" },
      ],
      "mock-a",
    );
    expect([...ids].sort()).toEqual(["t3"]);
  });

  it("filterPapersForMockPicker hides consumed papers but keeps selection", () => {
    const papers = buildFullPapers([
      base({ id: "r1", section: "reading_writing", title: "Paper A · Module 1", module: 1 }),
      base({ id: "r2", section: "reading_writing", title: "Paper A · Module 2", module: 2 }),
      base({ id: "r3", section: "reading_writing", title: "Paper B · Module 1", module: 1 }),
      base({ id: "r4", section: "reading_writing", title: "Paper B · Module 2", module: 2 }),
    ]);
    const used = new Set(["r1", "r2"]);
    const filtered = filterPapersForMockPicker(papers, used);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].module1.id).toBe("r3");

    const keepSelected = filterPapersForMockPicker(papers, used, [papers[0].key]);
    expect(keepSelected).toHaveLength(2);
  });
});
