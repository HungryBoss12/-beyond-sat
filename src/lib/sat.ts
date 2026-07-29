export const RW_SKILLS = [
  "Craft and Structure",
  "Information and Ideas",
  "Standard English Conventions",
  "Expression of Ideas",
] as const;

export const MATH_SKILLS = [
  "Algebra",
  "Advanced Math",
  "Problem-Solving and Data Analysis",
  "Geometry and Trigonometry",
] as const;

// ---------------------------------------------------------------------------
// Scoring
//
// Digital SAT structure: 54 Reading & Writing questions and 44 Math questions,
// each section scaled to 200-800, for a 400-1600 total.
//
// IMPORTANT: these are APPROXIMATE conversions. College Board does not publish
// its scaling curves, and the real exam is section-adaptive (your module 2
// difficulty, and therefore your ceiling, depends on module 1 performance). The
// tables below are interpolated from released practice-test curves and are good
// enough for tracking progress, but a real score can differ by a few dozen
// points. Anything user-facing should be labelled an estimate.
// ---------------------------------------------------------------------------

export const RW_QUESTION_COUNT = 54;
export const MATH_QUESTION_COUNT = 44;
export const SECTION_SCORE_MIN = 200;
export const SECTION_SCORE_MAX = 800;

/** Anchor points as [raw correct, scaled score], interpolated between. */
const RW_CURVE: readonly [number, number][] = [
  [0, 200], [5, 230], [10, 290], [15, 350], [20, 410], [25, 470],
  [30, 530], [35, 590], [40, 650], [45, 710], [49, 760], [52, 790], [54, 800],
];

const MATH_CURVE: readonly [number, number][] = [
  [0, 200], [4, 240], [8, 300], [12, 360], [16, 420], [20, 480],
  [24, 540], [28, 600], [32, 660], [36, 710], [40, 760], [42, 780], [44, 800],
];

function interpolate(curve: readonly [number, number][], raw: number): number {
  const max = curve[curve.length - 1][0];
  const clamped = Math.max(0, Math.min(max, raw));
  for (let i = 0; i < curve.length - 1; i++) {
    const [x1, y1] = curve[i];
    const [x2, y2] = curve[i + 1];
    if (clamped >= x1 && clamped <= x2) {
      const t = x2 === x1 ? 0 : (clamped - x1) / (x2 - x1);
      return Math.round(y1 + t * (y2 - y1));
    }
  }
  return curve[curve.length - 1][1];
}

/** Round to the nearest 10, as real SAT section scores are always multiples of 10. */
function toScoreStep(n: number): number {
  return Math.min(SECTION_SCORE_MAX, Math.max(SECTION_SCORE_MIN, Math.round(n / 10) * 10));
}

/** Raw correct count (0-54) -> scaled Reading & Writing score (200-800). */
export function rwRawToScaled(correct: number): number {
  return toScoreStep(interpolate(RW_CURVE, correct));
}

/** Raw correct count (0-44) -> scaled Math score (200-800). */
export function mathRawToScaled(correct: number): number {
  return toScoreStep(interpolate(MATH_CURVE, correct));
}

export function rawToScaled(section: Section, correct: number): number {
  return section === "reading_writing" ? rwRawToScaled(correct) : mathRawToScaled(correct);
}

export type ScoreEstimate = {
  rw: number;
  math: number;
  total: number;
};

/**
 * Full estimate from raw counts. With no answers at all the caller should show
 * 0 rather than the 400 floor — see `isEmptyScore`.
 */
export function estimateScore(rwCorrect: number, mathCorrect: number): ScoreEstimate {
  const rw = rwRawToScaled(rwCorrect);
  const math = mathRawToScaled(mathCorrect);
  return { rw, math, total: rw + math };
}

export const questionCountFor = (section: Section): number =>
  section === "reading_writing" ? RW_QUESTION_COUNT : MATH_QUESTION_COUNT;

/** Percentage of the 400-1600 range, for progress bars. */
export function scoreProgress(total: number): number {
  return Math.max(0, Math.min(100, ((total - 400) / 1200) * 100));
}

/** Qualitative band used for badges next to a total score. */
export function scoreBand(total: number): { label: string; tone: "excellent" | "good" | "fair" | "low" } {
  if (total >= 1400) return { label: "Excellent", tone: "excellent" };
  if (total >= 1200) return { label: "Good", tone: "good" };
  if (total >= 1000) return { label: "Fair", tone: "fair" };
  return { label: "Building", tone: "low" };
}

export type Section = "reading_writing" | "math";
export type Difficulty = "easy" | "medium" | "hard" | "C" | "B" | "D" | "A" | "S";
export type LetterDifficulty = "C" | "B" | "D" | "A" | "S";

export const LETTER_DIFFICULTIES: LetterDifficulty[] = ["C", "B", "D", "A", "S"];

export const SECTION_LABEL: Record<Section, string> = {
  reading_writing: "Reading & Writing",
  math: "Math",
};

export function skillsFor(section: Section): readonly string[] {
  return section === "reading_writing" ? RW_SKILLS : MATH_SKILLS;
}

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const;

export function formatSourceDate(month?: number | null, year?: number | null): string | null {
  if (!month || !year) return null;
  return `${MONTHS[month - 1]} ${year}`;
}

export function difficultyLabel(d: Difficulty | string | null | undefined): string {
  if (!d) return "—";
  const map: Record<string, string> = {
    easy: "C",
    medium: "B",
    hard: "A",
  };
  return (map[d as string] || d) as string;
}

export function difficultyColor(d: Difficulty | string | null | undefined): string {
  const label = difficultyLabel(d);
  switch (label) {
    case "S": return "bg-fuchsia-100 text-fuchsia-700";
    case "A": return "bg-red-50 text-red-600";
    case "B": return "bg-amber-50 text-amber-600";
    case "C": return "bg-emerald-50 text-emerald-600";
    case "D": return "bg-sky-50 text-sky-600";
    default: return "bg-slate-100 text-slate-600";
  }
}
