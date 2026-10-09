import { describe, expect, it } from "vitest";
import { dedupeKey, flagDuplicates, type ParsedQuestion, type RowResult } from "./question-import";

function row(index: number, overrides: Partial<ParsedQuestion>): RowResult {
  return {
    index,
    errors: [],
    warnings: [],
    question: {
      section: "reading_writing",
      skill: "Words in Context",
      difficulty: "medium",
      kind: "multiple_choice",
      prompt: "Passage one.",
      question_text: "Which choice completes the text with the most logical and precise word?",
      choices: [
        { id: "A", text: "alpha" },
        { id: "B", text: "beta" },
      ],
      correct_choice_id: "A",
      correct_grid_answers: null,
      explanation: null,
      image_url: null,
      source_month: null,
      source_year: null,
      time_limit_seconds: null,
      bank_format: "ordinary",
      external_id: null,
      assessment: null,
      domain: null,
      subskill: null,
      image_alt: null,
      published: false,
      ...overrides,
    } as ParsedQuestion,
  };
}

describe("question duplicate check", () => {
  it("does not flag a shared stem with a different passage", () => {
    const flagged = flagDuplicates([row(1, {}), row(2, { prompt: "Passage two." })], new Set());
    expect(flagged.map((r) => r.duplicate)).toEqual([false, false]);
  });

  it("flags an exact repeat in the batch", () => {
    const flagged = flagDuplicates([row(1, {}), row(2, {})], new Set());
    expect(flagged[1].duplicate).toBe(true);
  });

  it("flags a question already in the bank, ignoring spacing and case", () => {
    const existing = new Set([
      dedupeKey({
        section: "reading_writing",
        question_text: "  which choice completes the text with the most logical and   precise word?",
        prompt: "PASSAGE ONE.",
        choices: [{ text: "Alpha" }, { text: "Beta" }],
      }),
    ]);
    expect(flagDuplicates([row(1, {})], existing)[0].duplicate).toBe(true);
  });

  it("does not flag different answer choices", () => {
    const flagged = flagDuplicates(
      [row(1, {}), row(2, { choices: [{ id: "A", text: "gamma" }, { id: "B", text: "beta" }] })],
      new Set(),
    );
    expect(flagged[1].duplicate).toBe(false);
  });
});
