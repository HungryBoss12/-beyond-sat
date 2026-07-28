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
