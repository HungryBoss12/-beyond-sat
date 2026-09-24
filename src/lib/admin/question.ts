import type { Difficulty, Section } from "@/lib/sat";

export type AdminChoice = { id: string; text: string; image_url?: string | null };

export type BankFormat = "ordinary" | "sqb";

/** Saved (or draft-new) question as edited in the admin modal / SQB editor. */
export type AdminQuestion = {
  id: string;
  section: Section;
  skill: string;
  difficulty: Difficulty;
  kind: "multiple_choice" | "grid_in";
  prompt: string | null;
  question_text: string;
  choices: AdminChoice[];
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
  explanation: string | null;
  image_url: string | null;
  source_month: number | null;
  source_year: number | null;
  time_limit_seconds: number | null;
  bank_format: BankFormat;
  external_id: string | null;
  assessment: string | null;
  domain: string | null;
  subskill: string | null;
  image_alt: string | null;
  published: boolean;
};

export function emptyAdminQuestion(
  section: Section = "math",
  bankFormat: BankFormat = "ordinary",
): AdminQuestion {
  return {
    id: "",
    section,
    skill: section === "math" ? "Algebra" : "Craft and Structure",
    difficulty: "C",
    kind: "multiple_choice",
    prompt: "",
    question_text: "",
    choices: [
      { id: "A", text: "", image_url: null },
      { id: "B", text: "", image_url: null },
      { id: "C", text: "", image_url: null },
      { id: "D", text: "", image_url: null },
    ],
    correct_choice_id: "A",
    correct_grid_answers: [],
    explanation: "",
    image_url: null,
    source_month: null,
    source_year: new Date().getFullYear(),
    time_limit_seconds: null,
    bank_format: bankFormat,
    external_id: null,
    assessment: null,
    domain: null,
    subskill: null,
    image_alt: null,
    // SQB drafts start unpublished; ordinary stays visible by default.
    published: bankFormat !== "sqb",
  };
}

export function cloneAdminQuestion(q: AdminQuestion): AdminQuestion {
  return {
    ...q,
    choices: q.choices.map((c) => ({ ...c })),
    correct_grid_answers: q.correct_grid_answers ? [...q.correct_grid_answers] : null,
  };
}
