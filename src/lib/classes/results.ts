/** Per-lesson Results: M1 + M2 correct answers, shown as a section score. */

export const RESULT_MODULE_MAX = 27;

/** Raw total (M1 + M2) → section score. Anything else is N.A. */
const SECTION_SCORE: Record<number, string> = {
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

export function parseModule(raw: string): ModuleParse {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (!/^\d{1,2}$/.test(text)) return { kind: "error" };
  const value = Number(text);
  return value <= RESULT_MODULE_MAX ? { kind: "ok", value } : { kind: "error" };
}

export function resultScore(m1: number | null, m2: number | null): number | null {
  if (m1 == null || m2 == null) return null;
  return m1 + m2;
}

/** "—" until both modules are in. Otherwise the section score, or "N.A." off the table. */
export function resultLabel(m1: number | null, m2: number | null): string {
  const score = resultScore(m1, m2);
  if (score == null) return "—";
  return SECTION_SCORE[score] ?? "N.A.";
}
