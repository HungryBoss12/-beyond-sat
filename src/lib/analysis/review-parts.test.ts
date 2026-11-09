import { describe, expect, it } from "vitest";
import { knownParts, orderByIds, readSessionReviewMeta, tagInOrder } from "./review-parts";

describe("readSessionReviewMeta", () => {
  it("reads mock modules and a practice test id", () => {
    expect(
      readSessionReviewMeta({
        test_id: "t1",
        question_ids: ["a", 3, "b"],
        modules: [{ section: "math", module: 2, question_ids: ["a"] }, "nope"],
      }),
    ).toEqual({
      testId: "t1",
      questionIds: ["a", "b"],
      modules: [{ section: "math", module: 2, question_ids: ["a"] }],
    });
  });

  it("ignores empty metadata", () => {
    expect(readSessionReviewMeta(null)).toEqual({});
  });
});

describe("knownParts", () => {
  it("maps each mock module's questions", () => {
    const map = knownParts({
      modules: [
        { section: "reading_writing", module: 1, question_ids: ["rw-a"] },
        { section: "math", module: 2, question_ids: ["m-b"] },
      ],
    });
    expect(map.get("rw-a")).toEqual({ section: "reading_writing", module: 1 });
    expect(map.get("m-b")).toEqual({ section: "math", module: 2 });
  });

  it("puts a whole practice set on that test's module", () => {
    const map = knownParts({
      test: { section: "reading_writing", module: 2 },
      questionIds: ["q1", "q2"],
    });
    expect(map.get("q1")?.module).toBe(2);
    expect(map.get("q2")?.section).toBe("reading_writing");
  });
});

describe("tagInOrder", () => {
  it("keeps a module 2 practice set out of module 1", () => {
    const known = knownParts({
      test: { section: "math", module: 2 },
      questionIds: ["a", "b"],
    });
    const tagged = tagInOrder(
      [
        { id: "a", section: "math" },
        { id: "b", section: "math" },
      ],
      known,
    );
    expect(tagged.map((q) => q.part.module)).toEqual([2, 2]);
  });

  it("splits an unmarked reading set into 27 then the rest", () => {
    const questions = Array.from({ length: 28 }, (_, i) => ({
      id: `q${i}`,
      section: "reading_writing",
    }));
    const tagged = tagInOrder(questions, new Map());
    expect(tagged[26].part.module).toBe(1);
    expect(tagged[27].part.module).toBe(2);
  });

  it("does not let known questions shift the fallback count", () => {
    const known = knownParts({
      modules: [{ section: "reading_writing", module: 2, question_ids: ["known"] }],
    });
    const tagged = tagInOrder(
      [
        { id: "known", section: "reading_writing" },
        { id: "other", section: "reading_writing" },
      ],
      known,
    );
    expect(tagged[0].part.module).toBe(2);
    expect(tagged[1].part.module).toBe(1);
  });
});

describe("orderByIds", () => {
  it("follows the exam order instead of answer time", () => {
    const ordered = orderByIds([{ id: "b" }, { id: "a" }], ["a", "b"], (item) => item.id);
    expect(ordered.map((item) => item.id)).toEqual(["a", "b"]);
  });
});
