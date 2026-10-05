import type { ClassSubject } from "./types";
import { rwRawToScaled } from "@/lib/sat";

/** Per-lesson Results: M1 + M2 correct answers, shown as a section score. */

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

export function resultScore(m1: number | null, m2: number | null): number | null {
  if (m1 == null || m2 == null) return null;
  return m1 + m2;
}

/** "—" until both modules are in. Math uses the class table. English uses the Reading & Writing curve. */
export function resultLabel(
  m1: number | null,
  m2: number | null,
  subject: ClassSubject = "math",
): string {
  const score = resultScore(m1, m2);
  if (score == null) return "—";
  if (subject === "ebrw") {
    if (m1! > ENGLISH_MODULE_MAX || m2! > ENGLISH_MODULE_MAX) return "N.A.";
    return String(rwRawToScaled(score));
  }
  return MATH_SECTION_SCORE[score] ?? "N.A.";
}
