import { describe, expect, it } from "vitest";
import { groupOrphanMathQuestions, type OrphanMathQuestion } from "./load-existing";

describe("groupOrphanMathQuestions", () => {
  it("keeps a nameless math import together by the day it was added", () => {
    const rows: OrphanMathQuestion[] = Array.from({ length: 3 }, (_, index) => ({
      id: `q${index}`,
      source_month: null,
      source_year: 2026,
      created_at: "2026-10-28T11:21:44.000Z",
    }));
    rows.push({
      id: "older",
      source_month: null,
      source_year: 2026,
      created_at: "2026-10-01T08:00:00.000Z",
    });
    rows.push({
      id: "dated",
      source_month: 6,
      source_year: 2025,
      created_at: "2026-10-28T11:21:44.000Z",
    });

    const groups = groupOrphanMathQuestions(rows);
    expect(groups[0]).toMatchObject({
      key: "added:2026-10-28",
      label: "Added 28 Oct 2026 · no name",
      questionIds: ["q0", "q1", "q2"],
    });
    expect(groups.find((group) => group.key === "added:2026-10-01")?.questionIds).toEqual(["older"]);
    expect(groups.find((group) => group.key === "2025-6")?.label).toBe("June 2025");
  });
});
