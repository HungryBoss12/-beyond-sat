/** Homework schemes per sub-class. Mirrors SQL bs_group_scheme / bs_scheme_items. */

export type Subject = "math" | "ebrw";
export type SubjectSlug = "math" | "eng";
export type Scheme = "AFL" | "VAR";
export type HwItem = "vocab" | "assignment" | "article" | "formulas";

export const SCHEME_ITEMS: Record<Scheme, readonly HwItem[]> = {
  VAR: ["vocab", "assignment", "article"],
  AFL: ["assignment", "formulas"],
};

export const HW_ITEM_LETTER: Record<HwItem, string> = {
  vocab: "V",
  assignment: "A",
  article: "R",
  formulas: "F",
};

export const HW_ITEM_LABEL: Record<HwItem, string> = {
  vocab: "Vocabulary",
  assignment: "Assignment",
  article: "Article",
  formulas: "Formulas",
};

const FOOTER_WORD: Record<HwItem, string> = {
  vocab: "vocab",
  assignment: "assign",
  article: "article",
  formulas: "formulas",
};

export const SUBJECT_LABEL: Record<Subject, string> = { math: "Maths", ebrw: "Eng" };

export function schemeFor(subject: Subject): Scheme {
  return subject === "math" ? "AFL" : "VAR";
}

export function itemsFor(subject: Subject): readonly HwItem[] {
  return SCHEME_ITEMS[schemeFor(subject)];
}

export function allowsItem(subject: Subject, item: HwItem): boolean {
  return itemsFor(subject).includes(item);
}

export function subjectToSlug(subject: Subject): SubjectSlug {
  return subject === "math" ? "math" : "eng";
}

export function slugToSubject(slug: string): Subject | null {
  if (slug === "math") return "math";
  if (slug === "eng") return "ebrw";
  return null;
}

/** "Done: 4 vocab · 6 assign · 2 article" or "Done: 5 assign · 3 formulas · avg L 640". */
export function doneSummary(
  subject: Subject,
  counts: Partial<Record<HwItem, number>>,
  avgLevel?: number | null,
): string {
  const parts = itemsFor(subject).map((item) => `${counts[item] ?? 0} ${FOOTER_WORD[item]}`);
  if (subject === "math") parts.push(`avg L ${avgLevel == null ? "—" : avgLevel}`);
  return `Done: ${parts.join(" · ")}`;
}
