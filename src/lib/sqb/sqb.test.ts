import { describe, expect, it } from "vitest";
import { emptyAdminQuestion } from "@/lib/admin/question";
import { dryRunImport, forceBankFormat, parseJson } from "@/lib/question-import";
import {
  findKatexIssues,
  findPackExternalIdDupes,
  packExternalIdDupIssues,
  sqbPublishBlocked,
  sqbThemeTitle,
  themeFromSqbTitle,
  validateSqbPublish,
} from "@/lib/sqb";

function completeMcq() {
  const q = emptyAdminQuestion("math", "sqb");
  q.question_text = "What is $2+2$?";
  q.skill = "Algebra";
  q.domain = "Algebra";
  q.subskill = "Linear equations";
  q.difficulty = "B";
  q.assessment = "SAT";
  q.external_id = "abc12345";
  q.explanation = "Because $2+2=4$.";
  q.choices = [
    { id: "A", text: "3", image_url: null },
    { id: "B", text: "4", image_url: null },
    { id: "C", text: "5", image_url: null },
    { id: "D", text: "6", image_url: null },
  ];
  q.correct_choice_id = "B";
  return q;
}

describe("SQB publish gates", () => {
  it("blocks incomplete SQB drafts", () => {
    const q = emptyAdminQuestion("math", "sqb");
    expect(sqbPublishBlocked(q)).toBe(true);
    const issues = validateSqbPublish(q);
    expect(issues.some((i) => i.level === "error")).toBe(true);
  });

  it("allows a complete SQB MCQ", () => {
    expect(sqbPublishBlocked(completeMcq())).toBe(false);
  });

  it("hard-blocks empty stem", () => {
    const q = completeMcq();
    q.question_text = "";
    q.prompt = "";
    expect(sqbPublishBlocked(q)).toBe(true);
    expect(validateSqbPublish(q).some((i) => i.message.includes("Stem"))).toBe(true);
  });

  it("hard-blocks MCQ with no correct choice", () => {
    const q = completeMcq();
    q.correct_choice_id = null;
    expect(sqbPublishBlocked(q)).toBe(true);
  });

  it("hard-blocks grid-in with zero answers", () => {
    const q = completeMcq();
    q.kind = "grid_in";
    q.choices = [];
    q.correct_choice_id = null;
    q.correct_grid_answers = [];
    expect(sqbPublishBlocked(q)).toBe(true);
  });

  it("hard-blocks unbalanced $ on stem", () => {
    const q = completeMcq();
    q.question_text = "Solve $x=1";
    expect(sqbPublishBlocked(q)).toBe(true);
    expect(findKatexIssues(q.question_text).length).toBeGreaterThan(0);
  });

  it("hard-blocks unclosed $$ display math", () => {
    const bad = "$$\\frac{1}{";
    expect(findKatexIssues(bad).some((m) => m.includes("$$"))).toBe(true);
    const q = completeMcq();
    q.question_text = bad;
    expect(sqbPublishBlocked(q)).toBe(true);
  });

  it("hard-blocks unbalanced $ on a choice", () => {
    const q = completeMcq();
    q.choices[0] = { id: "A", text: "$6\\sqrt{3}", image_url: null };
    expect(sqbPublishBlocked(q)).toBe(true);
  });

  it("soft-only: figure above without image does not hard-block", () => {
    const q = completeMcq();
    q.question_text = "In the figure above, what is the radius?";
    q.image_url = null;
    const issues = validateSqbPublish(q);
    expect(issues.some((i) => i.level === "error")).toBe(false);
    expect(
      issues.some(
        (i) => i.level === "warning" && /figure|graph/i.test(i.message),
      ),
    ).toBe(true);
  });

  it("soft-only: missing explanation is a warning", () => {
    const q = completeMcq();
    q.explanation = "";
    const issues = validateSqbPublish(q);
    expect(sqbPublishBlocked(q)).toBe(false);
    expect(issues.some((i) => i.field === "explanation" && i.level === "warning")).toBe(
      true,
    );
  });

  it("hard-blocks missing Question ID", () => {
    const q = completeMcq();
    q.external_id = "";
    expect(sqbPublishBlocked(q)).toBe(true);
    expect(
      validateSqbPublish(q).some(
        (i) => i.field === "external_id" && i.level === "error",
      ),
    ).toBe(true);
  });

  it("rejects D and S as SQB difficulties", () => {
    const q = completeMcq();
    q.difficulty = "D";
    expect(sqbPublishBlocked(q)).toBe(true);
    q.difficulty = "S";
    expect(sqbPublishBlocked(q)).toBe(true);
    q.difficulty = "A";
    expect(sqbPublishBlocked(q)).toBe(false);
  });
});

describe("SQB pack external_id dupes", () => {
  it("flags duplicate external_id in pack", () => {
    const dups = findPackExternalIdDupes([
      { external_id: "abc" },
      { external_id: "abc" },
      { external_id: "xyz" },
    ]);
    expect([...dups]).toEqual(["abc"]);
    const issues = packExternalIdDupIssues([
      { id: "1", external_id: "abc" },
      { id: "2", external_id: "abc" },
    ]);
    expect(issues[0]?.level).toBe("error");
  });

  it("ignores blank external_ids", () => {
    expect(findPackExternalIdDupes([{ external_id: "" }, { external_id: null }]).size).toBe(
      0,
    );
  });
});

describe("SQB import", () => {
  it("parses SQB columns and stays unpublished", () => {
    const raw = JSON.stringify([
      {
        section: "math",
        skill: "Algebra",
        subskill: "Linear",
        difficulty: "C",
        kind: "multiple_choice",
        bank_format: "sqb",
        external_id: "abc12345",
        assessment: "SAT",
        question_text: "Solve $x=1$",
        choices: ["0", "1", "2", "3"],
        correct: "B",
      },
    ]);
    const parsed = parseJson(raw);
    expect(parsed.fatal).toBeNull();
    expect(parsed.rows[0]?.question?.bank_format).toBe("sqb");
    expect(parsed.rows[0]?.question?.published).toBe(false);
    expect(parsed.rows[0]?.question?.external_id).toBe("abc12345");
    expect(parsed.rows[0]?.question?.subskill).toBe("Linear");

    const dry = dryRunImport(parsed.rows);
    expect(dry.valid).toBe(1);
    expect(dry.sqb).toBe(1);

    const forced = forceBankFormat(parsed.rows, "sqb");
    expect(forced[0]?.question?.published).toBe(false);
  });

  it("errors when SQB row lacks Question ID", () => {
    const raw = JSON.stringify([
      {
        section: "math",
        skill: "Algebra",
        subskill: "Linear",
        difficulty: "C",
        kind: "multiple_choice",
        bank_format: "sqb",
        question_text: "Solve $x=1$",
        choices: ["0", "1", "2", "3"],
        correct: "B",
      },
    ]);
    const parsed = parseJson(raw);
    expect(parsed.fatal).toBeNull();
    expect(parsed.rows[0]?.question).toBeNull();
    expect(
      parsed.rows[0]?.errors.some((e) => /Question ID/i.test(e)),
    ).toBe(true);
  });

  it("accepts question_id alias for SQB", () => {
    const raw = JSON.stringify([
      {
        section: "math",
        skill: "Algebra",
        subskill: "Linear",
        difficulty: "A",
        kind: "multiple_choice",
        bank_format: "sqb",
        question_id: "deadbeef",
        question_text: "Solve $x=1$",
        choices: ["0", "1", "2", "3"],
        correct: "B",
      },
    ]);
    const parsed = parseJson(raw);
    expect(parsed.rows[0]?.question?.external_id).toBe("deadbeef");
  });
});

describe("sqbThemeTitle", () => {
  it("builds Math — Circles style titles", () => {
    expect(sqbThemeTitle("math", "Circles")).toBe("Math — Circles");
    expect(themeFromSqbTitle("Math — Circles", "math")).toBe("Circles");
    expect(themeFromSqbTitle("SQB · Math — Circles", "math")).toBe("Circles");
  });
});
