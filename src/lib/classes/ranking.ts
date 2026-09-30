export type RankLetter = "S" | "A" | "B" | "C" | "D";

export type RankTier = {
  letter: RankLetter;
  min: number;
  label: string;
  legend: string;
};

export const RANK_TIERS: RankTier[] = [
  { letter: "S", min: 1500, label: "S", legend: "1500+" },
  { letter: "A", min: 1400, label: "A", legend: "1400+" },
  { letter: "B", min: 1300, label: "B", legend: "1300+" },
  { letter: "C", min: 1200, label: "C", legend: "1200+" },
  { letter: "D", min: 0, label: "D", legend: "Not enough" },
];

const SCORE_MIN = 200;
const SCORE_MAX = 800;

export function clampScore(value: unknown): number | null {
  if (typeof value === "string" && value.trim() === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.min(SCORE_MAX, Math.max(SCORE_MIN, Math.round(n)));
}

export function totalScore(rw: number, math: number): number {
  return rw + math;
}

export function rankFor(total: number): RankTier {
  return RANK_TIERS.find((tier) => total >= tier.min) ?? RANK_TIERS[RANK_TIERS.length - 1]!;
}

export type RankedStudent = {
  name: string;
  rw: number;
  math: number;
  total: number;
};

export function compareRanked(a: RankedStudent, b: RankedStudent): number {
  if (b.total !== a.total) return b.total - a.total;
  if (b.math !== a.math) return b.math - a.math;
  return a.name.localeCompare(b.name);
}

/** Shared place numbers: equal totals keep the same place. */
export function placeFor(sorted: RankedStudent[], index: number): number {
  const row = sorted[index];
  if (!row) return index + 1;
  const first = sorted.findIndex((item) => item.total === row.total);
  return first + 1;
}
