import type { Section } from "@/lib/sat";

/** Official Digital SAT module lengths, used only when a session has no module map. */
export const RW_MODULE_SIZE = 27;
export const MATH_MODULE_SIZE = 22;

export type ReviewModule = 1 | 2;

export type ReviewPart = {
  section: Section;
  module: ReviewModule;
};

export type ModuleMeta = {
  section?: string;
  module?: number;
  question_ids?: unknown;
};

export const REVIEW_SECTIONS: Section[] = ["reading_writing", "math"];
export const REVIEW_MODULES: ReviewModule[] = [1, 2];

export function sectionChoiceLabel(section: Section): string {
  return section === "math" ? "Math" : "EBRW";
}

export function normalizeSection(section: string | null | undefined): Section {
  return section === "math" ? "math" : "reading_writing";
}

export function normalizeModule(module: number | null | undefined): ReviewModule {
  return module === 2 ? 2 : 1;
}

export type SessionReviewMeta = {
  modules?: ModuleMeta[];
  testId?: string;
  questionIds?: string[];
};

function stringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0);
}

export function readSessionReviewMeta(metadata: unknown): SessionReviewMeta {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return {};
  const raw = metadata as Record<string, unknown>;
  const modules = Array.isArray(raw.modules)
    ? raw.modules.filter((m): m is ModuleMeta => !!m && typeof m === "object" && !Array.isArray(m))
    : undefined;
  const questionIds = stringIds(raw.question_ids);
  const testId = typeof raw.test_id === "string" ? raw.test_id : undefined;
  return {
    modules: modules?.length ? modules : undefined,
    testId,
    questionIds: questionIds.length ? questionIds : undefined,
  };
}

/**
 * Question id → section and module.
 * Mocks store this on the session. A practice set is one published test, so
 * every question in that session shares the test's section and module.
 */
export function knownParts(input: {
  modules?: ModuleMeta[] | null;
  test?: { section: string; module: number } | null;
  questionIds?: string[] | null;
}): Map<string, ReviewPart> {
  const map = new Map<string, ReviewPart>();
  if (input.modules && input.modules.length > 0) {
    for (const entry of input.modules) {
      const part: ReviewPart = {
        section: normalizeSection(entry.section),
        module: normalizeModule(entry.module),
      };
      for (const id of stringIds(entry.question_ids)) map.set(id, part);
    }
    return map;
  }
  if (input.test) {
    const part: ReviewPart = {
      section: normalizeSection(input.test.section),
      module: normalizeModule(input.test.module),
    };
    for (const id of input.questionIds ?? []) map.set(id, part);
  }
  return map;
}

export function partFor(
  questionId: string,
  section: string,
  indexAmongUnknown: number,
  known: Map<string, ReviewPart>,
): ReviewPart {
  const hit = known.get(questionId);
  if (hit) return hit;
  const normalized = normalizeSection(section);
  const size = normalized === "math" ? MATH_MODULE_SIZE : RW_MODULE_SIZE;
  return { section: normalized, module: indexAmongUnknown >= size ? 2 : 1 };
}

export type Tagged<T> = T & { part: ReviewPart };

/** Keep exam order. Questions missing from the module map fall into Module 1, then Module 2. */
export function tagInOrder<T extends { id: string; section: string }>(
  questions: T[],
  known: Map<string, ReviewPart>,
): Tagged<T>[] {
  const unknownIndex = { reading_writing: 0, math: 0 };
  return questions.map((question) => {
    const hit = known.get(question.id);
    if (hit) return { ...question, part: hit };
    const section = normalizeSection(question.section);
    const index = unknownIndex[section];
    unknownIndex[section] += 1;
    return { ...question, part: partFor(question.id, question.section, index, known) };
  });
}

export function orderByIds<T>(
  items: T[],
  ids: string[] | undefined,
  idOf: (item: T) => string,
): T[] {
  if (!ids?.length) return items;
  const rank = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) =>
      (rank.get(idOf(a)) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(idOf(b)) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function countInPart<T extends { part: ReviewPart }>(
  items: T[],
  section: Section,
  module: ReviewModule,
): number {
  return items.filter((item) => item.part.section === section && item.part.module === module)
    .length;
}
