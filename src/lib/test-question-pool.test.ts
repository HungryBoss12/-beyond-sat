import { describe, expect, it } from "vitest";
import { mergeLinkedQuestions } from "./test-question-pool";

describe("mergeLinkedQuestions", () => {
  it("keeps questions that sit outside the newest page", () => {
    const recent = [
      { id: "new-1", question_text: "Newest" },
      { id: "new-2", question_text: "Also new" },
    ];
    const linked = [
      { id: "old-1", question_text: "From the uploaded test" },
      { id: "new-1", question_text: "Newest" },
    ];

    expect(mergeLinkedQuestions(recent, linked)).toEqual([
      { id: "old-1", question_text: "From the uploaded test" },
      { id: "new-1", question_text: "Newest" },
      { id: "new-2", question_text: "Also new" },
    ]);
  });

  it("leaves the recent page alone when every linked question is already in it", () => {
    const recent = [{ id: "q1", question_text: "Stem" }];
    expect(mergeLinkedQuestions(recent, recent)).toBe(recent);
  });
});
