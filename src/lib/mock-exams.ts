import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  formatSourceDate,
  paperKey,
  paperDateSortKey,
  resolvePaperSourceDate,
  stripModuleSuffix,
  type Section,
  type LetterDifficulty,
} from "@/lib/sat";

export type MockExamTest = {
  id: string;
  title: string;
  section: Section;
  module: 1 | 2;
  difficulty: LetterDifficulty;
  source_month: number | null;
  source_year: number | null;
};

export type FullPaper = {
  key: string;
  title: string;
  section: Section;
  module1: MockExamTest;
  module2: MockExamTest;
  source_month: number | null;
  source_year: number | null;
};

export type MockExamPayload = {
  title: string;
  description: string | null;
  rw_module1_time_seconds: number;
  rw_module2_time_seconds: number;
  math_module1_time_seconds: number;
  math_module2_time_seconds: number;
  rw_module1_threshold: number;
  math_module1_threshold: number;
  section_break_seconds: number;
  published: boolean;
};

export const DEFAULT_MOCK_TIMINGS: Omit<MockExamPayload, "title" | "description" | "published"> = {
  rw_module1_time_seconds: 1920,
  rw_module2_time_seconds: 1920,
  math_module1_time_seconds: 2100,
  math_module2_time_seconds: 2100,
  rw_module1_threshold: 15,
  math_module1_threshold: 12,
  section_break_seconds: 1200,
};

const SECTION_RANK: Record<Section, number> = {
  reading_writing: 0,
  math: 1,
};

type PaperSortable = {
  source_month: number | null;
  source_year: number | null;
  section: Section;
  /** Paper title — used to parse dates when source fields are incomplete. */
  title?: string;
};

const UNDATED_SORT_KEY = "0000-00";

function resolvedPaperSortMeta(item: PaperSortable): {
  sortKey: string;
  label: string;
  year: number;
  month: number;
} {
  const resolved = item.title
    ? resolvePaperSourceDate(item.title, item.source_month, item.source_year)
    : null;
  if (!resolved) {
    return { sortKey: UNDATED_SORT_KEY, label: "Undated", year: 0, month: 0 };
  }
  return {
    sortKey: paperDateSortKey(resolved.year, resolved.month),
    label: resolved.label,
    year: resolved.year,
    month: resolved.month,
  };
}

/** Newest date first, then EBRW before Math, then title. Undated always last. */
export function compareBySourceDateAndSection(a: PaperSortable, b: PaperSortable): number {
  const ra = resolvedPaperSortMeta(a);
  const rb = resolvedPaperSortMeta(b);

  if (ra.sortKey === UNDATED_SORT_KEY && rb.sortKey !== UNDATED_SORT_KEY) return 1;
  if (rb.sortKey === UNDATED_SORT_KEY && ra.sortKey !== UNDATED_SORT_KEY) return -1;
  if (ra.sortKey !== rb.sortKey) {
    return ra.sortKey < rb.sortKey ? 1 : -1;
  }

  const sectionDelta = SECTION_RANK[a.section] - SECTION_RANK[b.section];
  if (sectionDelta !== 0) return sectionDelta;
  return (a.title ?? "").localeCompare(b.title ?? "");
}

export type DatedPaperGroup<T> = {
  key: string;
  label: string;
  items: T[];
};

/** Bucket papers by resolved date; items inside each bucket follow date+section order. */
export function groupByPaperDate<T extends PaperSortable>(items: T[]): DatedPaperGroup<T>[] {
  const sorted = [...items].sort(compareBySourceDateAndSection);
  const buckets = new Map<string, DatedPaperGroup<T>>();

  for (const item of sorted) {
    const { sortKey, label } = resolvedPaperSortMeta(item);
    let bucket = buckets.get(sortKey);
    if (!bucket) {
      bucket = { key: sortKey, label, items: [] };
      buckets.set(sortKey, bucket);
    }
    bucket.items.push(item);
  }

  return [...buckets.values()].sort((a, b) => {
    if (a.key === UNDATED_SORT_KEY) return 1;
    if (b.key === UNDATED_SORT_KEY) return -1;
    return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
  });
}

/** One complete paper per title — first Mod1 + first Mod2 when multiples exist. */
export function buildFullPapers(tests: MockExamTest[]): FullPaper[] {
  const groups = new Map<
    string,
    {
      title: string;
      section: Section;
      module1: MockExamTest[];
      module2: MockExamTest[];
      source_month: number | null;
      source_year: number | null;
    }
  >();

  for (const test of tests) {
    const key = paperKey(test.title, test.section);
    const group = groups.get(key) ?? {
      title: stripModuleSuffix(test.title),
      section: test.section,
      module1: [],
      module2: [],
      source_month: test.source_month,
      source_year: test.source_year,
    };
    group[test.module === 1 ? "module1" : "module2"].push(test);
    groups.set(key, group);
  }

  const papers: FullPaper[] = [];
  for (const [groupKey, group] of groups) {
    const module1 = group.module1[0];
    const module2 = group.module2[0];
    if (!module1 || !module2) continue;
    papers.push({
      key: `${groupKey}:${module1.id}:${module2.id}`,
      title: group.title,
      section: group.section,
      module1,
      module2,
      source_month: group.source_month,
      source_year: group.source_year,
    });
  }
  return papers.sort(compareBySourceDateAndSection);
}

export function suggestMockTitle(rw: FullPaper, math: FullPaper): string {
  if (rw.title === math.title) return `${rw.title} · Full Mock`;
  const date = formatSourceDate(rw.source_month, rw.source_year);
  if (
    date &&
    rw.source_month === math.source_month &&
    rw.source_year === math.source_year
  ) {
    return `${date} · Full Mock`;
  }
  return `${rw.title} + ${math.title}`;
}

/** Prefer a Math paper with the same resolved date as the chosen R&W paper. */
export function matchPaperForSection(
  anchor: FullPaper,
  candidates: FullPaper[],
  section: Section,
): FullPaper | null {
  const pool = candidates.filter((p) => p.section === section);
  if (pool.length === 0) return null;

  const anchorKey = resolvedPaperSortMeta(anchor).sortKey;

  const byDate = pool.find((p) => {
    const key = resolvedPaperSortMeta(p).sortKey;
    return anchorKey !== UNDATED_SORT_KEY && key === anchorKey;
  });
  if (byDate) return byDate;

  const byTitle = pool.find((p) => p.title === anchor.title);
  if (byTitle) return byTitle;

  return pool[0] ?? null;
}

export type MockExamSectionLink = {
  mock_exam_id: string;
  test_id: string | null;
};

/** Test IDs already assigned to other mock exams (optionally keep one mock's links). */
export function collectUsedTestIds(
  sections: MockExamSectionLink[],
  excludeMockExamId?: string | null,
): Set<string> {
  const ids = new Set<string>();
  for (const row of sections) {
    if (!row.test_id) continue;
    if (excludeMockExamId && row.mock_exam_id === excludeMockExamId) continue;
    ids.add(row.test_id);
  }
  return ids;
}

/** Hide papers whose modules are linked to another mock; keep current selections visible. */
export function filterPapersForMockPicker(
  papers: FullPaper[],
  usedTestIds: Set<string>,
  selectedKeys: Iterable<string | null | undefined> = [],
): FullPaper[] {
  const keep = new Set([...selectedKeys].filter((k): k is string => Boolean(k)));
  return papers.filter(
    (paper) =>
      keep.has(paper.key) ||
      (!usedTestIds.has(paper.module1.id) && !usedTestIds.has(paper.module2.id)),
  );
}

export function paperFromGroup(
  group: {
    key: string;
    base: string;
    section: Section;
    mod1: MockExamTest[];
    mod2: MockExamTest[];
    source_month: number | null;
    source_year: number | null;
  },
): FullPaper | null {
  const module1 = group.mod1[0];
  const module2 = group.mod2[0];
  if (!module1 || !module2) return null;
  return {
    key: `${group.key}:${module1.id}:${module2.id}`,
    title: group.base,
    section: group.section,
    module1,
    module2,
    source_month: group.source_month,
    source_year: group.source_year,
  };
}

export async function saveMockExam(
  rwPaper: FullPaper,
  mathPaper: FullPaper,
  payload: MockExamPayload,
  existingId?: string,
): Promise<{ mockId: string; error?: string }> {
  if (!payload.title.trim()) {
    return { mockId: "", error: "Please enter a mock exam title." };
  }

  let mockId = existingId ?? "";
  const { title, description, published, ...timings } = payload;
  const row = { title: title.trim(), description, published, ...timings };

  if (mockId) {
    const { error } = await supabase.from("mock_exams").update(row).eq("id", mockId);
    if (error) return { mockId: "", error: error.message };
  } else {
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("mock_exams")
      .insert({ ...row, created_by: u.user?.id })
      .select("id")
      .single();
    if (error) return { mockId: "", error: error.message };
    mockId = data.id as string;
  }

  await supabase.from("mock_exam_sections").delete().eq("mock_exam_id", mockId);
  const rows = [rwPaper, mathPaper].flatMap((paper, sectionIndex) =>
    ([1, 2] as const).map((module) => ({
      mock_exam_id: mockId,
      module,
      section_index: sectionIndex + 1,
      section_name: SECTION_LABEL[paper.section],
      test_id: module === 1 ? paper.module1.id : paper.module2.id,
    })),
  );
  const { error: sectionsError } = await supabase.from("mock_exam_sections").insert(rows);
  if (sectionsError) return { mockId: "", error: sectionsError.message };

  return { mockId };
}
