import { blankDraft, type Draft, type ParseDefaults } from "@/lib/import/parse";
import { softSqbFixHintsForDraft } from "@/lib/import/load-existing";
import type { AdminChoice, AdminQuestion } from "@/lib/admin/question";
import { validateSqbPublish, type PublishIssue, mapSqbWordDifficulty } from "@/lib/sqb";
import type { Section } from "@/lib/sat";

export type SqbParseDefaults = ParseDefaults & {
  assessment?: string;
  domain?: string;
  subskill?: string;
};

/** Empty SQB draft stamped with bank_format + assessment defaults. */
export function blankSqbDraft(
  defaults: SqbParseDefaults,
  number: number,
  sourcePage?: number,
): Draft {
  const base = blankDraft(defaults, number, sourcePage);
  return {
    ...base,
    rec: {
      ...base.rec,
      bank_format: "sqb",
      assessment: defaults.assessment ?? "SAT",
      domain: defaults.domain ?? defaults.skill ?? "",
      subskill: defaults.subskill ?? "",
      external_id: "",
      image_alt: "",
      published: "false",
    },
  };
}

/** Ensure every draft carries SQB bank stamps. Theme packs always use module 1. */
export function stampSqbDrafts(drafts: Draft[], defaults?: SqbParseDefaults): Draft[] {
  return drafts.map((d) => ({
    ...d,
    rec: {
      ...d.rec,
      bank_format: "sqb",
      module: "1",
      assessment: (d.rec.assessment ?? "").trim() || defaults?.assessment || "SAT",
      domain: (d.rec.domain ?? "").trim() || defaults?.domain || d.rec.skill || "",
      subskill: (d.rec.subskill ?? "").trim() || defaults?.subskill || "",
      published: "false",
    },
  }));
}

export function softSqbHintsForDraft(draft: Draft): string[] {
  return softSqbFixHintsForDraft(draft);
}

/** Map a flat draft record into AdminQuestion shape for validateSqbPublish. */
export function draftToAdminQuestion(draft: Draft): AdminQuestion {
  const rec = draft.rec;
  const kind = rec.kind === "grid_in" ? "grid_in" : "multiple_choice";
  const choices: AdminChoice[] =
    kind === "multiple_choice"
      ? (["A", "B", "C", "D"] as const).map((id) => ({
          id,
          text: rec[`choice_${id}`] ?? "",
          image_url: rec[`choice_${id}_image`] || null,
        }))
      : [];
  const correct = (rec.correct ?? "").trim().toUpperCase();
  return {
    id: "",
    section: (rec.section === "math" ? "math" : "reading_writing") as Section,
    skill: rec.skill ?? "",
    difficulty: (rec.difficulty || "C") as AdminQuestion["difficulty"],
    kind,
    prompt: rec.prompt || null,
    question_text: rec.question_text ?? "",
    choices,
    image_url: rec.image_url || null,
    source_month: rec.source_month ? Number(rec.source_month) : null,
    source_year: rec.source_year ? Number(rec.source_year) : null,
    time_limit_seconds: null,
    bank_format: "sqb",
    external_id: rec.external_id || null,
    assessment: rec.assessment || null,
    domain: rec.domain || null,
    subskill: rec.subskill || null,
    image_alt: rec.image_alt || null,
    published: false,
    explanation: rec.explanation || null,
    correct_choice_id: kind === "multiple_choice" && /^[A-D]$/.test(correct) ? correct : null,
    correct_grid_answers:
      kind === "grid_in" && correct
        ? correct.split(/[,;]/).map((s) => s.trim()).filter(Boolean)
        : null,
  };
}

export function validateSqbDraft(draft: Draft): {
  errors: PublishIssue[];
  warnings: PublishIssue[];
} {
  const issues = validateSqbPublish(draftToAdminQuestion(draft));
  const soft = softSqbHintsForDraft(draft).map(
    (message): PublishIssue => ({ level: "warning", message }),
  );
  const hardMsgs = new Set(issues.filter((i) => i.level === "error").map((i) => i.message));
  const warnMsgs = new Set(issues.filter((i) => i.level === "warning").map((i) => i.message));
  const warnings = [
    ...issues.filter((i) => i.level === "warning"),
    ...soft.filter((s) => !hardMsgs.has(s.message) && !warnMsgs.has(s.message)),
  ];
  return {
    errors: issues.filter((i) => i.level === "error"),
    warnings,
  };
}

export function normalizeSqbDifficulty(raw: string, fallback = "C"): string {
  const mapped = mapSqbWordDifficulty(raw);
  if (mapped) return mapped;
  const t = raw.trim().toUpperCase();
  if (["C", "D", "B", "A", "S"].includes(t)) return t;
  return fallback;
}
