/** Level (L): 400-1000 per section. Mirrors SQL bs_level_overall. */

export const LEVEL_MIN = 400;
export const LEVEL_MAX = 1000;
export const LEVEL_STEP = 10;
export const LEVEL_STEP_BIG = 50;

export type LevelParse =
  | { kind: "empty" }
  | { kind: "ok"; value: number }
  | { kind: "error"; message: string };

export function parseLevelScore(raw: string): LevelParse {
  const text = raw.trim();
  if (!text) return { kind: "empty" };
  if (!/^\d+$/.test(text)) return { kind: "error", message: "Whole numbers only" };
  const value = Number(text);
  if (value < LEVEL_MIN || value > LEVEL_MAX) {
    return { kind: "error", message: `${LEVEL_MIN}–${LEVEL_MAX}` };
  }
  return { kind: "ok", value };
}

export function isLevelScore(value: unknown): value is number {
  return (
    typeof value === "number" && Number.isInteger(value) && value >= LEVEL_MIN && value <= LEVEL_MAX
  );
}

export type LevelEntry = { score: number | null | undefined; weight?: number };

/**
 * Weighted mean of the sections that have a score, rounded half-up.
 * Blank sections are left out; nothing scored gives null. Invalid scores throw.
 */
export function levelOverall(entries: readonly LevelEntry[]): number | null {
  let num = 0;
  let den = 0;
  for (const entry of entries) {
    if (entry.score == null) continue;
    if (!isLevelScore(entry.score)) {
      throw new RangeError(`Level score must be a whole number from ${LEVEL_MIN} to ${LEVEL_MAX}`);
    }
    const weight = entry.weight ?? 1;
    if (!Number.isInteger(weight) || weight < 1 || weight > 10) {
      throw new RangeError("Section weight must be 1-10");
    }
    num += entry.score * weight;
    den += weight;
  }
  if (den === 0) return null;
  return Math.floor((2 * num + den) / (2 * den));
}

export function stepLevel(current: number | null, direction: 1 | -1, big: boolean): number {
  const step = big ? LEVEL_STEP_BIG : LEVEL_STEP;
  const base = current ?? (direction > 0 ? LEVEL_MIN - step : LEVEL_MAX + step);
  return Math.min(LEVEL_MAX, Math.max(LEVEL_MIN, base + direction * step));
}

/** Short column header from a section name: "Command of Evidence (Textual)" -> "CET". */
export function sectionShort(name: string): string {
  const words = name
    .replace(/[(),&]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 1) return words[0]!.slice(0, 5);
  return words
    .filter((w) => !["and", "of", "the"].includes(w.toLowerCase()))
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 5);
}

export type LevelTrend = "up" | "down" | "flat";

export function levelTrend(current: number | null, previous: number | null): LevelTrend | null {
  if (current == null || previous == null) return null;
  if (current > previous) return "up";
  if (current < previous) return "down";
  return "flat";
}
