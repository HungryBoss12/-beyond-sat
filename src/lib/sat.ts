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
  [0, 200],
  [5, 230],
  [10, 290],
  [15, 350],
  [20, 410],
  [25, 470],
  [30, 530],
  [35, 590],
  [40, 650],
  [45, 710],
  [49, 760],
  [52, 790],
  [54, 800],
];

const MATH_CURVE: readonly [number, number][] = [
  [0, 200],
  [4, 240],
  [8, 300],
  [12, 360],
  [16, 420],
  [20, 480],
  [24, 540],
  [28, 600],
  [32, 660],
  [36, 710],
  [40, 760],
  [42, 780],
  [44, 800],
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
export function scoreBand(total: number): {
  label: string;
  tone: "excellent" | "good" | "fair" | "low";
} {
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
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function formatSourceDate(month?: number | null, year?: number | null): string | null {
  if (!month || !year) return null;
  return `${MONTHS[month - 1]} ${year}`;
}

const MONTH_NAME_RE =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

/**
 * Best-effort paper date for browse ordering: explicit source fields first,
 * then month/year parsed from the title (e.g. "2025 June E", "June 2025").
 */
export function resolvePaperSourceDate(
  title: string,
  sourceMonth?: number | null,
  sourceYear?: number | null,
): { year: number; month: number; label: string } | null {
  if (sourceMonth != null && sourceMonth >= 1 && sourceMonth <= 12 && sourceYear != null) {
    return {
      year: sourceYear,
      month: sourceMonth,
      label: `${MONTHS[sourceMonth - 1]} ${sourceYear}`,
    };
  }

  const base = stripModuleSuffix(title);
  const yearMatch = base.match(/\b(20\d{2}|19\d{2})\b/);
  const monthMatch = base.match(MONTH_NAME_RE);
  const parsedYear = yearMatch ? Number(yearMatch[1]) : sourceYear ?? null;
  let parsedMonth: number | null =
    sourceMonth != null && sourceMonth >= 1 && sourceMonth <= 12 ? sourceMonth : null;
  if (parsedMonth == null && monthMatch) {
    const idx = MONTHS.findIndex((m) => m.toLowerCase() === monthMatch[1].toLowerCase());
    if (idx >= 0) parsedMonth = idx + 1;
  }

  if (parsedYear != null && parsedMonth != null) {
    return {
      year: parsedYear,
      month: parsedMonth,
      label: `${MONTHS[parsedMonth - 1]} ${parsedYear}`,
    };
  }
  if (parsedYear != null) {
    return { year: parsedYear, month: 0, label: String(parsedYear) };
  }
  return null;
}

/** Sort key `YYYY-MM` (month `00` = year-only). Descending string compare = newest first. */
export function paperDateSortKey(year: number, month: number): string {
  return `${year}-${String(Math.max(0, Math.min(12, month))).padStart(2, "0")}`;
}

/** Strip a trailing module marker from a test title (`· Module 2`, `- Mod 1`, etc.). */
export function stripModuleSuffix(title: string): string {
  return title
    .replace(/\s*[·\-–—]\s*(?:mod(?:ule)?\.?\s*)?[12]\s*$/i, "")
    .replace(/\s*\(\s*mod(?:ule)?\.?\s*[12]\s*\)\s*$/i, "")
    .replace(/\s+m[12]\s*$/i, "")
    .trim();
}

/** Stable grouping key for pairing Module 1 / Module 2 rows into one paper. */
export function paperKey(title: string, section: Section): string {
  const base = stripModuleSuffix(title).toLowerCase().replace(/\s+/g, " ").trim();
  return `${section}:${base}`;
}

/** Canonical title for a module row within a paper. */
export function moduleTitle(base: string, module: 1 | 2): string {
  return `${base} · Module ${module}`;
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

/**
 * Difficulty chip classes. Rank reads through the brand ramp's lightness —
 * harder is lighter and more prominent — rather than through hue, so these chips
 * work on the navy surfaces they sit on and stay inside the palette.
 */
export function difficultyColor(d: Difficulty | string | null | undefined): string {
  const label = difficultyLabel(d);
  switch (label) {
    case "S":
      return "bg-brand-300 text-white";
    case "A":
      return "bg-brand-400 text-white";
    case "B":
      return "bg-brand-500 text-white";
    case "D":
      return "bg-brand-700 text-white";
    case "C":
      return "bg-brand-800 text-brand-100";
    default:
      return "bg-brand-800 text-brand-100";
  }
}
