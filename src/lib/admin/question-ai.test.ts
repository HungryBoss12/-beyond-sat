import { describe, expect, it } from "vitest";
import {
  applyRecToQuestion,
  questionToRec,
  softErrorsForQuestion,
} from "@/lib/admin/question-ai";
import { emptyAdminQuestion } from "@/lib/admin/question";

describe("questionToRec / applyRecToQuestion", () => {
  it("round-trips multiple-choice fields", () => {
    const q = emptyAdminQuestion();
    q.question_text = "What is $2+2$?";
    q.choices = [
      { id: "A", text: "3" },
      { id: "B", text: "4" },
      { id: "C", text: "5" },
      { id: "D", text: "6" },
    ];
    q.correct_choice_id = "B";
    q.explanation = "Because.";
    q.prompt = "Warm-up";

    const rec = questionToRec(q);
    expect(rec.choice_B).toBe("4");
    expect(rec.correct).toBe("B");

    const back = applyRecToQuestion(emptyAdminQuestion(), rec);
    expect(back.question_text).toBe("What is $2+2$?");
    expect(back.correct_choice_id).toBe("B");
    expect(back.choices.find((c) => c.id === "B")?.text).toBe("4");
    expect(back.explanation).toBe("Because.");
    expect(back.prompt).toBe("Warm-up");
  });

  it("maps grid-in answers from comma-separated correct", () => {
    const q = emptyAdminQuestion();
    q.kind = "grid_in";
    q.question_text = "Solve";
    q.correct_choice_id = null;
    q.correct_grid_answers = ["1/2", "0.5"];

    const rec = questionToRec(q);
    expect(rec.kind).toBe("grid_in");
    expect(rec.correct).toBe("1/2, 0.5");

    const back = applyRecToQuestion(q, { ...rec, correct: "2/4, .5" });
    expect(back.kind).toBe("grid_in");
    expect(back.correct_grid_answers).toEqual(["2/4", ".5"]);
  });

  it("reports soft errors for empty stem and choices", () => {
    const q = emptyAdminQuestion();
    q.question_text = "";
    const errors = softErrorsForQuestion(q);
    expect(errors.some((e) => e.includes("question text"))).toBe(true);
    expect(errors.some((e) => e.includes("Choice A"))).toBe(true);
  });
});
