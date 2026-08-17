import type { Difficulty, Section } from "@/lib/sat";

export type AdminChoice = { id: string; text: string };

/** Saved (or draft-new) question as edited in the admin modal. */
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
};

export function emptyAdminQuestion(): AdminQuestion {
  return {
    id: "",
    section: "math",
    skill: "Algebra",
    difficulty: "C",
    kind: "multiple_choice",
    prompt: "",
    question_text: "",
    choices: [
      { id: "A", text: "" },
      { id: "B", text: "" },
      { id: "C", text: "" },
      { id: "D", text: "" },
    ],
    correct_choice_id: "A",
    correct_grid_answers: [],
    explanation: "",
    image_url: null,
    source_month: null,
    source_year: new Date().getFullYear(),
    time_limit_seconds: null,
  };
}

export function cloneAdminQuestion(q: AdminQuestion): AdminQuestion {
  return {
    ...q,
    choices: q.choices.map((c) => ({ ...c })),
    correct_grid_answers: q.correct_grid_answers ? [...q.correct_grid_answers] : null,
  };
}
