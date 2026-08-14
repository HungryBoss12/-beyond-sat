import { FIGURE_MARKER } from "./docx";
import type { Draft } from "./parse";

export type FigureDependencyReason = "marker" | "docx_marker" | "phrase" | null;

export const FIGURE_NEEDED_MARKER_RE = /\[FIGURE NEEDED[^\]]*\]/i;

/** Strong wording that implies a visual is required even without an explicit marker. */
const STRONG_FIGURE_PHRASES: RegExp[] = [
  /shown in the (?:graph|figure|table|diagram|chart|picture|illustration)/i,
  /(?:graph|figure|table|diagram|chart) (?:above|below|shown|displays|represents)/i,
  /coordinate plane/i,
  /number line/i,
  /(?:triangle|circle|rectangle|polygon|angle|segment|line segment) (?:shown|above|below|in the figure)/i,
  /in the (?:figure|diagram|graph|table|chart)/i,
  /refer to the (?:figure|graph|table|diagram|chart)/i,
  /data (?:in|from) the (?:table|graph|chart)/i,
  /(?:what is|find|determine|calculate).*(?:area|perimeter|length|radius|diameter|slope|intercept).*(?:figure|diagram|graph|shown)/i,
];

export function hasFigureImage(rec: Record<string, string>): boolean {
  return (rec.image_url ?? "").trim().length > 0;
}

export function combinedQuestionText(rec: Record<string, string>): string {
  return `${rec.prompt ?? ""}\n${rec.question_text ?? ""}`;
}

/**
 * Why a draft still needs a real figure image, or null when satisfied / not dependent.
 */
export function figureDependencyReason(rec: Record<string, string>): FigureDependencyReason {
  if (hasFigureImage(rec)) return null;
  const blob = combinedQuestionText(rec);
  if (FIGURE_NEEDED_MARKER_RE.test(blob)) return "marker";
  if (blob.includes(FIGURE_MARKER)) return "docx_marker";
  for (const re of STRONG_FIGURE_PHRASES) {
    if (re.test(blob)) return "phrase";
  }
  return null;
}

export function needsFigure(draft: Draft): boolean {
  return figureDependencyReason(draft.rec) != null;
}

export function figureDependencyError(
  rec: Record<string, string>,
  opts: { fileImport?: boolean } = {},
): string | null {
  const reason = figureDependencyReason(rec);
  if (!reason) return null;
  if (reason === "phrase" && !opts.fileImport) return null;
  if (reason === "marker" || reason === "docx_marker") {
    return "This question needs a figure image — auto-attach, crop manually, or upload an image before importing.";
  }
  return "This question refers to a figure, graph, or table but has no image — auto-attach, crop manually, or upload an image before importing.";
}
