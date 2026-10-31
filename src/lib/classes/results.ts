import type { ClassSubject } from "./types";
import { rwRawToScaled } from "@/lib/sat";

/** Per-lesson Results: one correct-answer count per passage, shown as a section score. */

/** Reading & Writing module length. */
export const ENGLISH_MODULE_MAX = 27;
/** Math module length. */
export const MATH_MODULE_MAX = 22;
/** @deprecated Use moduleMax(subject). Kept for callers that still mean English. */
export const RESULT_MODULE_MAX = ENGLISH_MODULE_MAX;

export function moduleMax(subject: ClassSubject): number {
  return subject === "math" ? MATH_MODULE_MAX : ENGLISH_MODULE_MAX;
}

/** Math raw total (M1 + M2, each 0–22) → section score. Anything else is N.A. */
const MATH_SECTION_SCORE: Record<number, string> = {
  44: "800",
  43: "790",
  42: "770",
  41: "750-760",
  40: "730-740",
  39: "720",
  38: "700",
  37: "680",
  36: "660",
  35: "650",
  34: "640",
  33: "620",
  32: "610",
  31: "590",
  30: "570",
  29: "560",
  28: "550",
  27: "540",
  26: "520",
  25: "510",
  24: "500",
  23: "480",
};

export type ModuleParse = { kind: "empty" } | { kind: "ok"; value: number } | { kind: "error" };

export function parseModule(raw: string, max = ENGLISH_MODULE_MAX): ModuleParse {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (!/^\d{1,2}$/.test(text)) return { kind: "error" };
  const value = Number(text);
  return value <= max ? { kind: "ok", value } : { kind: "error" };
}

export function resultScore(scores: (number | null)[]): number | null {
  if (scores.length === 0 || scores.some((score) => score == null)) return null;
  return scores.reduce<number>((sum, score) => sum + (score ?? 0), 0);
}

/** Prefer the stored list. Older rows only have M1 and M2. */
export function resultValues(row: {
  scores?: (number | null)[] | null;
  m1?: number | null;
  m2?: number | null;
}): (number | null)[] {
  if (row.scores && row.scores.length > 0) return row.scores;
  return [row.m1 ?? null, row.m2 ?? null];
}

/** True when a reload already contains every number from the local save. */
export function reloadHasSave(savedScores: (number | null)[], incoming: (number | null)[]): boolean {
  if (incoming.length < savedScores.length) return false;
  return savedScores.every((score, index) => (incoming[index] ?? null) === score);
}

/**
 * Boxes to show after a reload. A dirty box is left as typed. A confirmed score
 * the reload does not contain yet stays on screen.
 */
export function boxesAfterReload(
  slots: number,
  incoming: (number | null)[],
  confirmed: (number | null)[] | null,
  dirty: string[] | null,
): string[] {
  if (dirty) {
    const padded = dirty.slice(0, slots);
    while (padded.length < slots) padded.push("");
    return padded;
  }
  const scores = confirmed && !reloadHasSave(confirmed, incoming) ? confirmed : incoming;
  return Array.from({ length: slots }, (_, index) =>
    scores[index] == null ? "" : String(scores[index]),
  );
}

/** "—" until every passage is in. Math uses the class table. English uses the Reading & Writing curve. */
export function resultLabel(scores: (number | null)[], subject: ClassSubject = "math"): string {
  const max = moduleMax(subject);
  if (scores.some((score) => score != null && score > max)) return "N.A.";
  const score = resultScore(scores);
  if (score == null) return "—";
  // The Reading & Writing curve stops at two modules (54). A larger sum is not a section score.
  if (subject === "ebrw") return score > ENGLISH_MODULE_MAX * 2 ? "N.A." : String(rwRawToScaled(score));
  return MATH_SECTION_SCORE[score] ?? "N.A.";
}
