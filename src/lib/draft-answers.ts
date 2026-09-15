import { emptyAnswer, isAnswered, type AnswerState, type QuestionRow } from "@/components/QuestionCard";

function coerceAnswer(raw: unknown): AnswerState | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Partial<AnswerState>;
  return {
    selectedChoiceId: typeof row.selectedChoiceId === "string" ? row.selectedChoiceId : null,
    gridAnswer: typeof row.gridAnswer === "string" ? row.gridAnswer : "",
    eliminated: Array.isArray(row.eliminated)
      ? row.eliminated.filter((x): x is string => typeof x === "string")
      : [],
    markedForReview: row.markedForReview === true,
    highlights: Array.isArray(row.highlights) ? (row.highlights as AnswerState["highlights"]) : [],
  };
}

export function hydrateDraftAnswers(
  questions: Pick<QuestionRow, "id" | "kind">[],
  drafts: unknown,
): AnswerState[] {
  const base = questions.map(() => emptyAnswer());
  if (!drafts) return base;
  if (Array.isArray(drafts)) {
    for (let i = 0; i < questions.length; i++) {
      const next = coerceAnswer(drafts[i]);
      if (next) base[i] = next;
    }
    return base;
  }
  if (typeof drafts === "object") {
    const map = drafts as Record<string, unknown>;
    questions.forEach((q, i) => {
      const next = coerceAnswer(map[q.id]);
      if (next) base[i] = next;
    });
  }
  return base;
}

export function draftsByQuestionId(
  questions: Pick<QuestionRow, "id">[],
  answers: AnswerState[],
): Record<string, AnswerState> {
  const out: Record<string, AnswerState> = {};
  questions.forEach((q, i) => {
    if (answers[i]) out[q.id] = answers[i];
  });
  return out;
}

export function countAnsweredDrafts(drafts: unknown, kinds?: QuestionRow["kind"][]): number {
  if (!drafts) return 0;
  const rows = Array.isArray(drafts)
    ? drafts
    : Object.values(drafts as Record<string, unknown>);
  return rows.reduce((n, raw, i) => {
    const a = coerceAnswer(raw);
    if (!a) return n;
    const kind = kinds?.[i] ?? (a.gridAnswer.trim() ? "grid_in" : "multiple_choice");
    return n + (isAnswered(a, kind) || a.markedForReview ? 1 : 0);
  }, 0);
}
