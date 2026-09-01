import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  formatSourceDate,
  paperKey,
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
  published: boolean;
};

export const DEFAULT_MOCK_TIMINGS: Omit<MockExamPayload, "title" | "description" | "published"> = {
  rw_module1_time_seconds: 1920,
  rw_module2_time_seconds: 1920,
  math_module1_time_seconds: 2100,
  math_module2_time_seconds: 2100,
  rw_module1_threshold: 15,
  math_module1_threshold: 12,
};

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
  return papers.sort((a, b) => {
    const ay = a.source_year ?? 0;
    const by = b.source_year ?? 0;
    if (ay !== by) return by - ay;
    const am = a.source_month ?? 0;
    const bm = b.source_month ?? 0;
    if (am !== bm) return bm - am;
    return a.title.localeCompare(b.title);
  });
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

/** Prefer a Math paper with the same source date as the chosen R&W paper. */
export function matchPaperForSection(
  anchor: FullPaper,
  candidates: FullPaper[],
  section: Section,
): FullPaper | null {
  const pool = candidates.filter((p) => p.section === section);
  if (pool.length === 0) return null;

  const byDate = pool.find(
    (p) =>
      anchor.source_month != null &&
      anchor.source_year != null &&
      p.source_month === anchor.source_month &&
      p.source_year === anchor.source_year,
  );
  if (byDate) return byDate;

  const byTitle = pool.find((p) => p.title === anchor.title);
  if (byTitle) return byTitle;

  return pool[0] ?? null;
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
