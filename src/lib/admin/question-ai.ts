import { applyFixToDraft, fixDraftWithGemini, type FixDraftResult } from "@/lib/import/fix-broken";
import { diffRec } from "@/lib/import/activity-log";
import type { Draft } from "@/lib/import/parse";
import {
  LETTER_DIFFICULTIES,
  MATH_SKILLS,
  RW_SKILLS,
  type Difficulty,
  type LetterDifficulty,
  type Section,
} from "@/lib/sat";
import { cloneAdminQuestion, type AdminChoice, type AdminQuestion } from "./question";

const CHOICE_LETTERS = ["A", "B", "C", "D"] as const;

/** Flat import-style record for POST /api/import/fix. */
export function questionToRec(q: AdminQuestion): Record<string, string> {
  const choice = (id: string) => (q.choices.find((c) => c.id === id)?.text ?? "").trim();

  const correct =
    q.kind === "grid_in"
      ? (q.correct_grid_answers ?? []).join(", ")
      : (q.correct_choice_id ?? "").trim();

  return {
    section: q.section,
    skill: q.skill,
    difficulty: q.difficulty,
    kind: q.kind,
    prompt: q.prompt ?? "",
    question_text: q.question_text ?? "",
    choice_A: choice("A"),
    choice_B: choice("B"),
    choice_C: choice("C"),
    choice_D: choice("D"),
    correct,
    explanation: q.explanation ?? "",
    image_url: q.image_url ?? "",
    source_month: q.source_month != null ? String(q.source_month) : "",
    source_year: q.source_year != null ? String(q.source_year) : "",
  };
}

function parseKind(raw: string): AdminQuestion["kind"] {
  const v = raw.trim().toLowerCase();
  if (v === "grid_in" || v === "grid-in" || v === "student_produced" || v === "spr") {
    return "grid_in";
  }
  return "multiple_choice";
}

function parseSection(raw: string, fallback: Section): Section {
  const v = raw.trim().toLowerCase();
  if (v === "math" || v === "m") return "math";
  if (v === "reading_writing" || v === "reading & writing" || v === "rw" || v === "english") {
    return "reading_writing";
  }
  return fallback;
}

function parseDifficulty(raw: string, fallback: Difficulty): Difficulty {
  const v = raw.trim().toUpperCase();
  if ((LETTER_DIFFICULTIES as string[]).includes(v)) return v as LetterDifficulty;
  return fallback;
}

function parseIntOrNull(raw: string): number | null {
  const n = Number(raw.trim());
  return Number.isFinite(n) ? Math.round(n) : null;
}

function ensureChoices(choices: AdminChoice[]): AdminChoice[] {
  return CHOICE_LETTERS.map((id) => {
    const existing = choices.find((c) => c.id === id);
    return { id, text: existing?.text ?? "" };
  });
}

/** Merge a flat import-style record back into an AdminQuestion. */
export function applyRecToQuestion(q: AdminQuestion, rec: Record<string, string>): AdminQuestion {
  const next = cloneAdminQuestion(q);
  const section = parseSection(rec.section ?? "", next.section);
  const kind = parseKind(rec.kind ?? next.kind);
  const skills = section === "math" ? MATH_SKILLS : RW_SKILLS;
  const skillRaw = (rec.skill ?? next.skill).trim();
  const skill = skills.includes(skillRaw as never) ? skillRaw : skills[0];

  next.section = section;
  next.skill = skill;
  next.difficulty = parseDifficulty(rec.difficulty ?? "", next.difficulty);
  next.kind = kind;
  if ("prompt" in rec) next.prompt = rec.prompt || null;
  if ("question_text" in rec) next.question_text = rec.question_text ?? "";
  if ("explanation" in rec) next.explanation = rec.explanation || null;
  if ("image_url" in rec) next.image_url = (rec.image_url ?? "").trim() || null;

  if ("source_month" in rec) {
    const m = parseIntOrNull(rec.source_month ?? "");
    next.source_month = m != null && m >= 1 && m <= 12 ? m : null;
  }
  if ("source_year" in rec) {
    next.source_year = parseIntOrNull(rec.source_year ?? "");
  }

  next.choices = ensureChoices(
    CHOICE_LETTERS.map((id) => ({
      id,
      text: (rec[`choice_${id}`] ?? next.choices.find((c) => c.id === id)?.text ?? "").trim(),
    })),
  );

  const correct = (rec.correct ?? "").trim();
  if (kind === "grid_in") {
    next.correct_choice_id = null;
    next.correct_grid_answers = correct
      ? correct
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
  } else {
    next.correct_grid_answers = null;
    const letter = correct.charAt(0).toUpperCase();
    next.correct_choice_id = CHOICE_LETTERS.includes(letter as (typeof CHOICE_LETTERS)[number])
      ? letter
      : (next.correct_choice_id ?? "A");
  }

  return next;
}

function asDraft(rec: Record<string, string>): Draft {
  return { number: 1, rec, warnings: [] };
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function applyFixedContent(
  q: AdminQuestion,
  content: string,
): {
  question: AdminQuestion;
  changedKeys: string[];
} {
  const obj = extractJsonObject(content);
  if (!obj) throw new Error("AI returned no usable fields.");
  const before = questionToRec(q);
  const draft = applyFixToDraft(asDraft(before), obj);
  const question = applyRecToQuestion(q, draft.rec);
  const changedKeys = diffRec(before, questionToRec(question)).map((f) => f.key);
  return { question, changedKeys };
}

/** Soft checks used as Fix-with-AI error hints for older messy rows. */
export function softErrorsForQuestion(q: AdminQuestion): string[] {
  const errors: string[] = [];
  if (!(q.question_text ?? "").trim()) errors.push("Missing question text.");
  if (q.kind === "multiple_choice") {
    for (const id of CHOICE_LETTERS) {
      const text = q.choices.find((c) => c.id === id)?.text ?? "";
      if (!text.trim()) errors.push(`Choice ${id} is empty.`);
    }
    if (!(q.correct_choice_id ?? "").trim()) errors.push("No correct choice marked.");
  } else if (!(q.correct_grid_answers ?? []).length) {
    errors.push("No accepted grid answers.");
  }
  return errors;
}

export type QuestionAiResult = {
  question: AdminQuestion;
  changedKeys: string[];
  fallback?: boolean;
};

export async function askQuestionWithGemini(
  q: AdminQuestion,
  instruction: string,
  opts: { signal?: AbortSignal } = {},
): Promise<QuestionAiResult> {
  const trimmed = instruction.trim();
  if (!trimmed) throw new Error("Type an instruction first.");

  const result: FixDraftResult = await fixDraftWithGemini(
    {
      number: 1,
      rec: questionToRec(q),
      errors: [],
      warnings: [],
      instruction: trimmed,
    },
    { signal: opts.signal, stage: "ask" },
  );

  const applied = applyFixedContent(q, result.content);
  return { ...applied, fallback: result.fallback };
}

/** One-click extract + recheck repair for a saved question. */
export async function fixQuestionWithGemini(
  q: AdminQuestion,
  opts: { signal?: AbortSignal } = {},
): Promise<QuestionAiResult> {
  const errors = softErrorsForQuestion(q);
  const warnings =
    errors.length === 0 ? ["Staff requested a cleanup pass on an existing bank question."] : [];

  const first = await fixDraftWithGemini(
    {
      number: 1,
      rec: questionToRec(q),
      errors: errors.length > 0 ? errors : ["General cleanup of stem, choices, and answer."],
      warnings,
    },
    { signal: opts.signal, stage: "extract" },
  );

  let content = first.content;
  const fallback = first.fallback === true;

  try {
    const recheck = await fixDraftWithGemini(
      {
        number: 1,
        rec: questionToRec(q),
        errors,
        warnings,
      },
      { signal: opts.signal, stage: "recheck", priorFix: first.content },
    );
    content = recheck.content;
  } catch {
    /* Keep the extract pass if recheck fails — same as import batch behavior. */
  }

  const applied = applyFixedContent(q, content);
  return { ...applied, fallback };
}
