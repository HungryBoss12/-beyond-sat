/** Per-lesson Results: M1 + M2 correct answers. Mirrors lesson_results checks. */

export const RESULT_MODULE_MAX = 27;
export const RESULT_NA_BELOW = 30;

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

/** "—" until both modules are in, "N.A." below the threshold, otherwise the score. */
export function resultLabel(m1: number | null, m2: number | null): string {
  const score = resultScore(m1, m2);
  if (score == null) return "—";
  return score < RESULT_NA_BELOW ? "N.A." : String(score);
}
