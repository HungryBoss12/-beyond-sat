/**
 * Parse Question Bank–style PDF text pages into draft records.
 *
 * Format reference (Circles / Right triangles SQB exports): each page typically has
 * Question ID, stem, A.–D. choices, then Assessment / Test / Domain / Skill / Difficulty.
 * Use as layout/metadata mapping only — never seed College Board stems into production.
 */
import type { Draft, ParseDefaults, SourceBlock } from "@/lib/import/parse";
import { normalizeSqbDifficulty, stampSqbDrafts, type SqbParseDefaults } from "./draft";
import type { Section } from "@/lib/sat";

function joinLines(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function pickSection(raw: string, fallback: Section): Section {
  const v = raw.trim().toLowerCase();
  if (v.includes("math")) return "math";
  if (v.includes("reading") || v.includes("writing") || v === "rw") return "reading_writing";
  return fallback;
}

function extractLabeled(body: string, label: string): string {
  const re = new RegExp(
    `${label}\\s*\\n([\\s\\S]*?)(?=\\n(?:Assessment|Test|Domain|Skill|Difficulty|Question ID|ID:)\\b|$)`,
    "i",
  );
  const m = body.match(re);
  if (!m) return "";
  return m[1].replace(/\n+/g, " ").trim();
}

function parseChoiceBlock(stemAndChoices: string): {
  stem: string;
  choices: Record<"A" | "B" | "C" | "D", string>;
} {
  const choices = { A: "", B: "", C: "", D: "" };
  // Split on A. B. C. D. (SQB style) or A) B) C) D)
  const parts = stemAndChoices.split(/\n(?=[A-D][.)]\s*)/);
  let stem = "";
  for (const part of parts) {
    const cm = part.match(/^([A-D])[.)]\s*([\s\S]*)$/);
    if (cm) {
      const id = cm[1] as "A" | "B" | "C" | "D";
      choices[id] = cm[2].replace(/\n+/g, " ").trim();
    } else if (!stem) {
      stem = part.replace(/\n+/g, " ").trim();
    } else {
      stem = `${stem} ${part.replace(/\n+/g, " ").trim()}`.trim();
    }
  }
  return { stem, choices };
}

function parseOnePage(
  raw: string,
  page: number | undefined,
  defaults: SqbParseDefaults,
  number: number,
): Draft | null {
  const text = joinLines(raw);
  if (!text) return null;

  const idMatch =
    text.match(/Question\s*ID\s*([A-Za-z0-9_-]+)/i) ||
    text.match(/\bID:\s*([A-Za-z0-9_-]+)/i);
  const externalId = idMatch?.[1]?.trim() ?? "";

  // Strip footer metadata for stem parsing
  const metaStart = text.search(/\nAssessment\b/i);
  const body = metaStart >= 0 ? text.slice(0, metaStart).trim() : text;
  const meta = metaStart >= 0 ? text.slice(metaStart).trim() : "";

  // Remove leading ID lines from body
  const stemBlock = body
    .replace(/^Question\s*ID\s*\S+\s*/i, "")
    .replace(/^ID:\s*\S+\s*/i, "")
    .trim();

  const { stem, choices } = parseChoiceBlock(stemBlock);
  if (!stem && !externalId) return null;

  const assessment = extractLabeled(meta, "Assessment") || defaults.assessment || "SAT";
  const testLabel = extractLabeled(meta, "Test");
  const domain = extractLabeled(meta, "Domain") || defaults.domain || defaults.skill || "";
  const skillLabel = extractLabeled(meta, "Skill") || defaults.subskill || "";
  const diffRaw = extractLabeled(meta, "Difficulty");
  const difficulty = normalizeSqbDifficulty(diffRaw, defaults.difficulty || "C");
  const section = pickSection(testLabel, defaults.section);

  const warnings: string[] = [];
  if (!stem) warnings.push("Empty stem after SQB parse — fill in the Editor.");
  if (!choices.A && !choices.B) warnings.push("Choices missing from text layer — may be image-only.");
  if (!diffRaw) warnings.push("Difficulty missing from PDF footer — using Setup default.");

  return {
    number,
    sourcePage: page,
    warnings,
    rec: {
      section,
      skill: domain || defaults.skill,
      difficulty,
      kind: "multiple_choice",
      prompt: "",
      question_text: stem,
      correct: "",
      explanation: "",
      source_month: defaults.source_month,
      source_year: defaults.source_year,
      module: defaults.module ?? "1",
      choice_A: choices.A,
      choice_B: choices.B,
      choice_C: choices.C,
      choice_D: choices.D,
      bank_format: "sqb",
      assessment,
      domain,
      subskill: skillLabel,
      external_id: externalId,
      image_alt: "",
      published: "false",
    },
  };
}

/**
 * Convert PDF text blocks (one page ≈ one SQB item) into drafts.
 * Falls back to joining consecutive non-empty pages when a page lacks an ID header.
 */
export function sqbBlocksToDrafts(
  blocks: Array<string | SourceBlock>,
  defaults: SqbParseDefaults,
): { drafts: Draft[]; notes: string[] } {
  const notes: string[] = [];
  const drafts: Draft[] = [];
  let n = 1;

  for (const b of blocks) {
    const text = typeof b === "string" ? b : b.text;
    const page = typeof b === "string" ? undefined : b.page;
    const draft = parseOnePage(text, page, defaults, n);
    if (draft) {
      drafts.push(draft);
      n += 1;
    }
  }

  if (drafts.length === 0) {
    notes.push(
      "No SQB-style items detected (looking for Question ID + Assessment/Domain/Skill footers). Try vision extract or Blank pack.",
    );
  } else {
    notes.push(
      `Parsed ${drafts.length} SQB item${drafts.length === 1 ? "" : "s"} from text (format reference mapping — author original content before publish).`,
    );
  }

  return { drafts: stampSqbDrafts(drafts, defaults), notes };
}

export function isLikelySqbPdfText(sample: string): boolean {
  const t = sample.slice(0, 4000);
  return (
    /Question\s*ID/i.test(t) &&
    /\bAssessment\b/i.test(t) &&
    /\bDomain\b/i.test(t) &&
    /\bSkill\b/i.test(t)
  );
}

export type { ParseDefaults, SqbParseDefaults };
