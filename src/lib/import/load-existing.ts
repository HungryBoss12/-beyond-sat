import { supabase } from "@/integrations/supabase/client";
import { replaceTestQuestions } from "@/lib/admin-writes";
import { loadQuestionWithAnswers } from "@/components/admin/question-edit-modal";
import { questionToRec, softErrorsForQuestion } from "@/lib/admin/question-ai";
import type { AdminQuestion } from "@/lib/admin/question";
import type { Draft } from "@/lib/import/parse";
import { figureDependencyError } from "@/lib/import/figure-dependency";
import type { Section } from "@/lib/sat";

const EXISTING_ID_KEY = "_existing_id";

export type ExistingTestSummary = {
  id: string;
  title: string;
  section: Section;
  module: 1 | 2;
  source_month: number | null;
  source_year: number | null;
  questionCount: number;
};

export type OrphanMathGroup = {
  key: string;
  label: string;
  source_month: number | null;
  source_year: number | null;
  /** Set when the questions have no month, so they are grouped by the day they were added. */
  addedOn: string | null;
  questionIds: string[];
};

export type OrphanMathQuestion = {
  id: string;
  source_month: number | null;
  source_year: number | null;
  created_at: string;
};

/** Questions with no month are one group per day they were added, not one pile per year. */
export function groupOrphanMathQuestions(rows: OrphanMathQuestion[]): OrphanMathGroup[] {
  const groups = new Map<string, OrphanMathGroup>();
  for (const q of rows) {
    const dated = q.source_year != null && q.source_month != null;
    const addedOn = q.created_at.slice(0, 10);
    const key = dated ? `${q.source_year}-${q.source_month}` : `added:${addedOn || "unknown"}`;
    const label = dated
      ? `${MONTH_NAMES[q.source_month! - 1] ?? q.source_month} ${q.source_year}`
      : addedOn
        ? `Added ${formatAddedDay(addedOn)} · no name`
        : "No source date";
    const g = groups.get(key) ?? {
      key,
      label,
      source_month: dated ? q.source_month : null,
      source_year: dated ? q.source_year : null,
      addedOn: dated ? null : addedOn || null,
      questionIds: [],
    };
    g.questionIds.push(q.id);
    groups.set(key, g);
  }

  return [...groups.values()].sort((a, b) => {
    if (a.addedOn && b.addedOn && a.addedOn !== b.addedOn) return b.addedOn.localeCompare(a.addedOn);
    if (a.addedOn && !b.addedOn) return -1;
    if (!a.addedOn && b.addedOn) return 1;
    const ay = a.source_year ?? 0;
    const by = b.source_year ?? 0;
    if (ay !== by) return by - ay;
    return (b.source_month ?? 0) - (a.source_month ?? 0);
  });
}

function formatAddedDay(isoDay: string): string {
  const [year, month, day] = isoDay.split("-").map(Number);
  if (!year || !month || !day) return isoDay;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type MathPracticeDiag = {
  mathQuestionCount: number;
  mathSetsTotal: number;
  mathSetsWithQuestions: number;
  orphanCount: number;
};

export function existingIdFromDraft(draft: Draft): string | null {
  const id = (draft.rec[EXISTING_ID_KEY] ?? "").trim();
  return id || null;
}

export function draftFromAdminQuestion(
  q: AdminQuestion,
  opts: { number: number; module?: 1 | 2 } = { number: 1 },
): Draft {
  const rec = questionToRec(q);
  rec[EXISTING_ID_KEY] = q.id;
  if (opts.module) rec.module = String(opts.module);
  const soft = softErrorsForQuestion(q);
  const fig = figureDependencyError(rec, { fileImport: true });
  const warnings = [
    ...soft.map((e) => `Soft: ${e}`),
    ...(fig ? [fig] : []),
    "Loaded from bank for AI recheck.",
  ];
  return {
    number: opts.number,
    rec,
    warnings,
  };
}

/** Strip the private id key before insert/update payloads from validateRecord. */
export function stripExistingId(rec: Record<string, string>): Record<string, string> {
  const next = { ...rec };
  delete next[EXISTING_ID_KEY];
  return next;
}

export async function diagnoseMathPractice(): Promise<MathPracticeDiag> {
  const [{ count: mathQuestionCount }, testsRes, orphans] = await Promise.all([
    supabase
      .from("questions")
      .select("id", { count: "exact", head: true })
      .eq("section", "math"),
    supabase.from("tests").select("id").eq("section", "math"),
    listOrphanMathGroups(),
  ]);

  const testIds = ((testsRes.data ?? []) as { id: string }[]).map((t) => t.id);
  let mathSetsWithQuestions = 0;
  if (testIds.length > 0) {
    const { data: links } = await supabase
      .from("test_questions")
      .select("test_id")
      .in("test_id", testIds);
    const withQ = new Set((links ?? []).map((r) => (r as { test_id: string }).test_id));
    mathSetsWithQuestions = withQ.size;
  }

  return {
    mathQuestionCount: mathQuestionCount ?? 0,
    mathSetsTotal: testIds.length,
    mathSetsWithQuestions,
    orphanCount: orphans.reduce((n, g) => n + g.questionIds.length, 0),
  };
}

export async function listExistingTests(
  preferSection?: Section,
  opts?: { bankFormat?: "ordinary" | "sqb" },
): Promise<ExistingTestSummary[]> {
  let q = supabase
    .from("tests")
    .select("id,title,section,module,source_month,source_year")
    .order("source_year", { ascending: false, nullsFirst: false })
    .order("source_month", { ascending: false, nullsFirst: false })
    .order("title");
  if (preferSection) q = q.eq("section", preferSection);
  if (opts?.bankFormat) q = q.eq("bank_format", opts.bankFormat);

  const { data, error } = await q.limit(200);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Omit<ExistingTestSummary, "questionCount">[];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.id);
  const { data: links } = await supabase
    .from("test_questions")
    .select("test_id")
    .in("test_id", ids);

  const counts = new Map<string, number>();
  for (const link of links ?? []) {
    const tid = (link as { test_id: string }).test_id;
    counts.set(tid, (counts.get(tid) ?? 0) + 1);
  }

  const summaries: ExistingTestSummary[] = rows.map((r) => ({
    ...r,
    section: r.section as Section,
    module: (r.module === 2 ? 2 : 1) as 1 | 2,
    questionCount: counts.get(r.id) ?? 0,
  }));

  // Prefer math; empty sets first so staff see what needs repair.
  summaries.sort((a, b) => {
    if (a.section !== b.section) {
      if (a.section === "math") return -1;
      if (b.section === "math") return 1;
    }
    if (a.questionCount === 0 && b.questionCount > 0) return -1;
    if (b.questionCount === 0 && a.questionCount > 0) return 1;
    return a.title.localeCompare(b.title);
  });

  return summaries;
}

export async function listOrphanMathGroups(): Promise<OrphanMathGroup[]> {
  const all = await fetchMathQuestionPages();
  if (all.length === 0) return [];

  const linkedIds = new Set<string>();
  for (let i = 0; i < all.length; i += 200) {
    const ids = all.slice(i, i + 200).map((q) => q.id);
    const { data: linked, error: linkError } = await supabase
      .from("test_questions")
      .select("question_id")
      .in("question_id", ids);
    if (linkError) throw new Error(linkError.message);
    for (const row of linked ?? []) {
      linkedIds.add((row as { question_id: string }).question_id);
    }
  }

  return groupOrphanMathQuestions(all.filter((q) => !linkedIds.has(q.id)));
}

/** A draft still using the automatic title has not been named yet. */
export function draftNeedsName(title: string): boolean {
  return /^untitled\b/i.test(title.trim());
}

/** Turn each nameless math pile into an unpublished test so it can be named and dated. */
export async function adoptNamelessMathDrafts(): Promise<number> {
  const groups = (await listOrphanMathGroups()).filter((group) => group.addedOn && group.questionIds.length > 0);
  if (groups.length === 0) return 0;
  const { data: userData } = await supabase.auth.getUser();
  let made = 0;
  for (const group of groups) {
    const { data, error } = await supabase
      .from("tests")
      .insert({
        title: `Untitled · ${formatAddedDay(group.addedOn!)}`,
        section: "math",
        module: 1,
        difficulty: "C",
        source_month: null,
        source_year: null,
        published: false,
        bank_format: "ordinary",
        created_by: userData.user?.id ?? null,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    try {
      await replaceTestQuestions(data.id, group.questionIds);
    } catch (linkError) {
      await supabase.from("tests").delete().eq("id", data.id);
      throw linkError;
    }
    made += 1;
  }
  return made;
}

async function fetchMathQuestionPages(): Promise<OrphanMathQuestion[]> {
  const page = 1000;
  const rows: OrphanMathQuestion[] = [];
  for (let from = 0; ; from += page) {
    const { data, error } = await supabase
      .from("questions")
      .select("id,source_month,source_year,created_at")
      .eq("section", "math")
      .order("created_at", { ascending: false })
      .range(from, from + page - 1);
    if (error) throw new Error(error.message);
    const batch = (data ?? []) as OrphanMathQuestion[];
    rows.push(...batch);
    if (batch.length < page) break;
  }
  return rows;
}

const MONTH_NAMES = [
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
];

type QuestionRow = {
  id: string;
  section: Section;
  skill: string;
  difficulty: AdminQuestion["difficulty"];
  kind: AdminQuestion["kind"];
  prompt: string | null;
  question_text: string;
  choices: AdminQuestion["choices"] | null;
  image_url: string | null;
  source_month: number | null;
  source_year: number | null;
  time_limit_seconds: number | null;
};

async function loadQuestionsByIds(
  ids: string[],
  moduleById?: Map<string, 1 | 2>,
): Promise<Draft[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("questions")
    .select(
      "id,section,skill,difficulty,kind,prompt,question_text,choices,image_url,source_month,source_year,time_limit_seconds",
    )
    .in("id", ids);
  if (error) throw new Error(error.message);

  const byId = new Map((data ?? []).map((r) => [r.id as string, r as QuestionRow]));
  const drafts: Draft[] = [];
  let n = 0;
  for (const id of ids) {
    const row = byId.get(id);
    if (!row) continue;
    n += 1;
    const full = await loadQuestionWithAnswers({
      id: row.id,
      section: row.section,
      skill: row.skill,
      difficulty: row.difficulty,
      kind: row.kind,
      prompt: row.prompt,
      question_text: row.question_text,
      choices: row.choices ?? [],
      image_url: row.image_url,
      source_month: row.source_month,
      source_year: row.source_year,
      time_limit_seconds: row.time_limit_seconds,
    });
    drafts.push(
      draftFromAdminQuestion(full, {
        number: n,
        module: moduleById?.get(id),
      }),
    );
  }
  return drafts;
}

export async function loadTestAsDrafts(testId: string): Promise<{
  drafts: Draft[];
  test: ExistingTestSummary;
}> {
  const { data: test, error: te } = await supabase
    .from("tests")
    .select("id,title,section,module,source_month,source_year")
    .eq("id", testId)
    .single();
  if (te) throw new Error(te.message);

  const { data: links, error: le } = await supabase
    .from("test_questions")
    .select("question_id,position")
    .eq("test_id", testId)
    .order("position", { ascending: true });
  if (le) throw new Error(le.message);

  const ordered = (links ?? []) as { question_id: string; position: number }[];
  const moduleById = new Map<string, 1 | 2>();
  const mod = (test.module === 2 ? 2 : 1) as 1 | 2;
  for (const l of ordered) moduleById.set(l.question_id, mod);

  const drafts = await loadQuestionsByIds(
    ordered.map((l) => l.question_id),
    moduleById,
  );

  return {
    drafts,
    test: {
      id: test.id as string,
      title: test.title as string,
      section: test.section as Section,
      module: mod,
      source_month: test.source_month as number | null,
      source_year: test.source_year as number | null,
      questionCount: drafts.length,
    },
  };
}

export async function loadOrphanQuestionsAsDrafts(
  questionIds: string[],
  defaultModule: 1 | 2 = 1,
): Promise<Draft[]> {
  const moduleById = new Map<string, 1 | 2>();
  for (const id of questionIds) moduleById.set(id, defaultModule);
  return loadQuestionsByIds(questionIds, moduleById);
}

/** Soft / figure issues even when validateRecord would pass. */
export function softFixHintsForDraft(draft: Draft): string[] {
  const hints: string[] = [];
  if (!(draft.rec.question_text ?? "").trim()) hints.push("Missing question text.");
  const kind = (draft.rec.kind ?? "multiple_choice").toLowerCase();
  if (kind === "grid_in" || kind === "grid-in" || kind === "spr") {
    if (!(draft.rec.correct ?? "").trim()) hints.push("No accepted grid answers.");
  } else {
    for (const id of ["A", "B", "C", "D"] as const) {
      if (!(draft.rec[`choice_${id}`] ?? "").trim()) hints.push(`Choice ${id} is empty.`);
    }
    if (!(draft.rec.correct ?? "").trim()) hints.push("No correct choice marked.");
  }
  const fig = figureDependencyError(draft.rec, { fileImport: true });
  if (fig) hints.push(fig);
  // Mild LaTeX imbalance heuristic
  const blob = `${draft.rec.prompt ?? ""}\n${draft.rec.question_text ?? ""}`;
  const dollars = (blob.match(/\$/g) ?? []).length;
  if (dollars % 2 === 1) hints.push("Unbalanced $ in LaTeX.");
  return hints;
}

/** Soft hints for SQB drafts — ordinary soft issues plus taxonomy / figure-alt. */
export function softSqbFixHintsForDraft(draft: Draft): string[] {
  const hints = softFixHintsForDraft(draft);
  if (!(draft.rec.domain ?? "").trim() && !(draft.rec.skill ?? "").trim()) {
    hints.push("Missing Domain (skill).");
  }
  if (!(draft.rec.subskill ?? "").trim()) hints.push("Missing Skill (subskill).");
  if (!(draft.rec.explanation ?? "").trim()) hints.push("Missing explanation.");
  const stem = (draft.rec.question_text ?? "").trim();
  if (stem.length > 0 && stem.length < 12) hints.push("Stem looks very short.");
  if ((draft.rec.image_url ?? "").trim() && !(draft.rec.image_alt ?? "").trim()) {
    hints.push("Figure needs image alt text.");
  }
  return hints;
}
