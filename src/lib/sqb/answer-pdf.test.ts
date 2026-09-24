import { describe, expect, it } from "vitest";
import {
  applySqbAnswers,
  parseSqbAnswerPages,
  parseSqbAnswersJson,
} from "./answer-pdf";
import type { Draft } from "@/lib/import/parse";

function page(id: string, letter: string, rationale = "Choice is correct."): string {
  return [
    `Question ID ${id}`,
    `ID: ${id}`,
    "Some stem text here.",
    "A. one",
    "B. two",
    "C. three",
    "D. four",
    `ID: ${id} Answer`,
    `Correct Answer: ${letter}`,
    "Rationale",
    rationale,
  ].join("\n");
}

function draft(externalId: string, number: number): Draft {
  return {
    number,
    warnings: [],
    rec: {
      section: "math",
      skill: "Geometry",
      difficulty: "C",
      kind: "multiple_choice",
      prompt: "",
      question_text: "stem",
      correct: "",
      explanation: "",
      source_month: "",
      source_year: "",
      module: "1",
      choice_A: "a",
      choice_B: "b",
      choice_C: "c",
      choice_D: "d",
      bank_format: "sqb",
      assessment: "SAT",
      domain: "Geometry",
      subskill: "Circles",
      external_id: externalId,
      image_alt: "",
      published: "false",
    },
  };
}

describe("parseSqbAnswerPages", () => {
  it("extracts Question ID and Correct Answer", () => {
    const parsed = parseSqbAnswerPages([
      page("858fd1cf", "C", "Choice C is correct."),
      page("9adb86ed", "B"),
    ]);
    expect(parsed.ordered).toHaveLength(2);
    expect(parsed.byExternalId.get("858fd1cf")?.correct).toBe("C");
    expect(parsed.byExternalId.get("9adb86ed")?.correct).toBe("B");
    expect(parsed.byExternalId.get("858fd1cf")?.explanation).toContain("Choice C");
  });
});

describe("applySqbAnswers", () => {
  it("stamps correct by external_id and fills empty explanation", () => {
    const drafts = [draft("858fd1cf", 1), draft("9adb86ed", 2)];
    const parsed = parseSqbAnswerPages([page("858fd1cf", "C", "Why C."), page("9adb86ed", "B")]);
    const out = applySqbAnswers(drafts, parsed);
    expect(out.matched).toBe(2);
    expect(out.drafts[0].rec.correct).toBe("C");
    expect(out.drafts[0].rec.explanation).toContain("Why C");
    expect(out.drafts[1].rec.correct).toBe("B");
  });

  it("does not overwrite an existing explanation", () => {
    const d = draft("858fd1cf", 1);
    d.rec.explanation = "Keep me";
    const parsed = parseSqbAnswerPages([page("858fd1cf", "A", "New rationale")]);
    const out = applySqbAnswers([d], parsed);
    expect(out.drafts[0].rec.correct).toBe("A");
    expect(out.drafts[0].rec.explanation).toBe("Keep me");
  });

  it("falls back to order when IDs missing on drafts", () => {
    const drafts = [draft("", 1), draft("", 2)];
    const parsed = parseSqbAnswerPages([page("aaa", "A"), page("bbb", "D")]);
    const out = applySqbAnswers(drafts, parsed);
    expect(out.byOrder).toBe(2);
    expect(out.drafts.map((x) => x.rec.correct)).toEqual(["A", "D"]);
  });
});

describe("parseSqbAnswersJson", () => {
  it("parses array by external_id", () => {
    const { parsed, error } = parseSqbAnswersJson(
      JSON.stringify([
        { external_id: "858fd1cf", correct: "C", explanation: "Why C." },
        { question_id: "9adb86ed", correct: "b" },
      ]),
    );
    expect(error).toBeNull();
    expect(parsed.byExternalId.get("858fd1cf")?.correct).toBe("C");
    expect(parsed.byExternalId.get("9adb86ed")?.correct).toBe("B");
    expect(parsed.byExternalId.get("858fd1cf")?.explanation).toContain("Why C");
  });

  it("accepts { answers: [...] } and grid-in arrays", () => {
    const { parsed, error } = parseSqbAnswersJson(
      JSON.stringify({ answers: [{ correct: ["3/4", "0.75"] }] }),
    );
    expect(error).toBeNull();
    expect(parsed.ordered[0]?.correct).toBe("3/4, 0.75");
  });

  it("applies JSON answers onto drafts", () => {
    const { parsed } = parseSqbAnswersJson(
      JSON.stringify([{ external_id: "858fd1cf", correct: "A" }]),
    );
    const out = applySqbAnswers([draft("858fd1cf", 1)], parsed);
    expect(out.matched).toBe(1);
    expect(out.drafts[0].rec.correct).toBe("A");
  });
});
