import type { AdminQuestion } from "@/lib/admin/question";
import type { Difficulty, Section } from "@/lib/sat";

/** SQB letter scale: hardest → easiest. */
export const SQB_DIFFICULTIES = ["A", "B", "C"] as const;
export type SqbDifficulty = (typeof SQB_DIFFICULTIES)[number];

export const SQB_DIFFICULTY_HINT: Record<SqbDifficulty, string> = {
  A: "hardest",
  B: "medium",
  C: "easiest",
};

/** Default pack title from section + theme (e.g. Math — Circles). */
export function sqbThemeTitle(section: Section, theme: string): string {
  const sectionLabel = section === "math" ? "Math" : "Reading & Writing";
  const t = theme.trim();
  return t ? `${sectionLabel} — ${t}` : sectionLabel;
}

/** True when title still matches the auto pattern for this section/theme (or is empty). */
export function isAutoSqbThemeTitle(title: string, section: Section, theme: string): boolean {
  const t = title.trim();
  if (!t) return true;
  return t === sqbThemeTitle(section, theme);
}

/** Pull theme from a title like `Math — Circles` / `SQB · Math — Circles`. */
export function themeFromSqbTitle(title: string, section: Section): string {
  const sectionLabel = section === "math" ? "Math" : "Reading & Writing";
  const cleaned = title
    .replace(/^SQB\s*[·\-–—]\s*/i, "")
    .replace(/\s*[·\-–—]\s*Module\s*[12]\s*$/i, "")
    .trim();
  const escaped = sectionLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`^${escaped}\\s*[—\\-–]\\s*(.+)$`, "i");
  const m = cleaned.match(re);
  return m?.[1]?.trim() ?? "";
}

/** Map SQB Easy/Medium/Hard wording onto BeyondSAT letters. */
export function mapSqbWordDifficulty(raw: string): SqbDifficulty | null {
  const v = raw.trim().toLowerCase();
  if (v === "easy") return "C";
  if (v === "medium") return "B";
  if (v === "hard") return "A";
  const upper = raw.trim().toUpperCase();
  if ((SQB_DIFFICULTIES as readonly string[]).includes(upper)) return upper as SqbDifficulty;
  return null;
}

export function isSqbDifficulty(d: Difficulty | string | null | undefined): d is SqbDifficulty {
  return typeof d === "string" && (SQB_DIFFICULTIES as readonly string[]).includes(d);
}

const FIGURE_HINT =
  /\b(figure|graph|chart|table|diagram|image|above|below|shown)\b/i;

export type PublishIssue = {
  level: "error" | "warning";
  field?: string;
  message: string;
};

/**
 * Hard gates and soft warnings for publishing an SQB question.
 * Ordinary questions should not call this for their save path.
 */
export function validateSqbPublish(q: AdminQuestion): PublishIssue[] {
  const issues: PublishIssue[] = [];
  const stem = (q.question_text ?? "").trim();
  const prompt = (q.prompt ?? "").trim();

  if (!stem && !prompt) {
    issues.push({ level: "error", field: "question_text", message: "Stem (or prompt) is required." });
  }

  if (!(q.skill ?? "").trim()) {
    issues.push({ level: "error", field: "skill", message: "Domain (skill) is required." });
  }

  if (!(q.subskill ?? "").trim()) {
    issues.push({ level: "error", field: "subskill", message: "Skill (subskill) is required to publish." });
  }

  if (!(q.external_id ?? "").trim()) {
    issues.push({
      level: "error",
      field: "external_id",
      message: "Question ID is required to publish.",
    });
  }

  if (!isSqbDifficulty(q.difficulty)) {
    issues.push({
      level: "error",
      field: "difficulty",
      message: "Difficulty must be A, B, or C.",
    });
  }

  if (q.kind === "multiple_choice") {
    const filled = q.choices.filter((c) => (c.text ?? "").trim() || c.image_url);
    if (filled.length < 4) {
      issues.push({
        level: "error",
        field: "choices",
        message: "MCQ needs choices A–D (text or image each).",
      });
    }
    if (!q.correct_choice_id) {
      issues.push({
        level: "error",
        field: "correct_choice_id",
        message: "Mark the correct choice.",
      });
    }
  } else {
    const answers = (q.correct_grid_answers ?? []).map((a) => a.trim()).filter(Boolean);
    if (answers.length === 0) {
      issues.push({
        level: "error",
        field: "correct_grid_answers",
        message: "Grid-in needs at least one acceptable answer.",
      });
    }
  }

  if (q.image_url && !(q.image_alt ?? "").trim()) {
    issues.push({
      level: "error",
      field: "image_alt",
      message: "Figure alt text is required when an image is set.",
    });
  }

  const katexBlob = [
    stem,
    prompt,
    ...(q.kind === "multiple_choice" ? q.choices.map((c) => c.text ?? "") : []),
  ].join("\n");
  const katexIssues = findKatexIssues(katexBlob);
  for (const msg of katexIssues) {
    issues.push({ level: "error", field: "question_text", message: msg });
  }

  if (!q.image_url && FIGURE_HINT.test(stem + " " + prompt)) {
    issues.push({
      level: "warning",
      field: "image_url",
      message: "Stem mentions a figure/graph but no image is attached.",
    });
  }

  if (!(q.explanation ?? "").trim()) {
    issues.push({
      level: "warning",
      field: "explanation",
      message: "Missing explanation.",
    });
  }

  if (stem.length > 0 && stem.length < 12) {
    issues.push({
      level: "warning",
      field: "question_text",
      message: "Stem looks very short.",
    });
  }

  return issues;
}

/**
 * Lightweight KaTeX delimiter sanity — not a full parse.
 * Detects unbalanced `$…$`, unclosed `$$…$$`, and unbalanced `\(…\)` / `\[…\]`.
 */
export function findKatexIssues(text: string): string[] {
  const issues: string[] = [];
  let dollars = 0;
  let displayOpen = false;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "\\" && text[i + 1] === "$") {
      i++;
      continue;
    }
    if (text[i] === "$") {
      if (text[i + 1] === "$") {
        displayOpen = !displayOpen;
        i++;
        continue;
      }
      dollars++;
    }
  }
  if (displayOpen) {
    issues.push("Unclosed $$…$$ KaTeX display delimiters.");
  }
  if (dollars % 2 !== 0) {
    issues.push("Unbalanced $…$ KaTeX delimiters.");
  }
  const parenOpen = (text.match(/\\\(/g) ?? []).length;
  const parenClose = (text.match(/\\\)/g) ?? []).length;
  if (parenOpen !== parenClose) {
    issues.push("Unbalanced \\( … \\) KaTeX delimiters.");
  }
  const bracketOpen = (text.match(/\\\[/g) ?? []).length;
  const bracketClose = (text.match(/\\\]/g) ?? []).length;
  if (bracketOpen !== bracketClose) {
    issues.push("Unbalanced \\[ … \\] KaTeX delimiters.");
  }
  return issues;
}

/** External IDs that appear more than once in a pack (case-sensitive, trimmed). */
export function findPackExternalIdDupes(
  items: Array<{ external_id?: string | null }>,
): Set<string> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const id = (item.external_id ?? "").trim();
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([id]) => id));
}

export function packExternalIdDupIssues(
  items: Array<{ id?: string; external_id?: string | null }>,
): PublishIssue[] {
  const dups = findPackExternalIdDupes(items);
  if (dups.size === 0) return [];
  return [
    {
      level: "error",
      field: "external_id",
      message: `Duplicate external_id in pack: ${[...dups].join(", ")}`,
    },
  ];
}

export function sqbPublishBlocked(q: AdminQuestion): boolean {
  return validateSqbPublish(q).some((i) => i.level === "error");
}

/** Default domain text from skill when domain is blank. */
export function resolveDomain(q: Pick<AdminQuestion, "domain" | "skill">): string {
  return (q.domain ?? "").trim() || (q.skill ?? "").trim();
}

export const QUESTION_SELECT_COLS =
  "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,source_month,source_year,time_limit_seconds,bank_format,external_id,assessment,domain,subskill,image_alt,published,created_at,updated_at,created_by";
