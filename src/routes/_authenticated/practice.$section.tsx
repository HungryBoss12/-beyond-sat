import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import {
  ArrowLeft,
  Filter,
  Play,
  Loader2,
  CalendarDays,
  RotateCcw,
  Layers,
  BookOpenCheck,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Shuffle,
  CheckCircle2,
  Circle,
  CircleDot,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  SECTION_LABEL,
  stripModuleSuffix,
  paperKey,
  paperDateSortKey,
  resolvePaperSourceDate,
  difficultyLabel,
  type Section,
  type Difficulty,
} from "@/lib/sat";
import { startPracticeSession, startTestSetSession } from "@/lib/session";
import { practiceSetProgressPct } from "@/lib/dashboard-mocks";
import type { AnswerState } from "@/components/QuestionCard";
import { Panel, EmptyState, Skeleton } from "@/components/ui/panel";
import { RevealCard } from "@/components/ui/reveal-card";
import { errorMessage, cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/practice/$section")({
  parseParams: (p) => {
    const s = p.section;
    if (s !== "reading_writing" && s !== "math") throw notFound();
    return { section: s as Section };
  },
  component: SectionBrowse,
  head: ({ params }) => ({
    meta: [
      {
        title: `${params.section === "math" ? "Math" : "Reading & Writing"} Practice — BeyondSAT`,
      },
    ],
  }),
});

/**
 * Practice sets, listed by the date the paper was sat.
 *
 * This screen used to render every question's text in a scrollable list, which
 * meant a student could read the entire bank — every stem, in order — without
 * ever starting a test. The answers themselves were never at risk (`SELECT` on
 * `questions.correct_choice_id` is revoked at column level, and `grade_answer()`
 * is the only way one is ever returned), but a question you have already read at
 * leisure is not a question any more.
 *
 * So nothing here selects `question_text`. A set exposes its title, its date, how
 * many questions it holds and how far the student has got — and the questions
 * themselves arrive only inside a session.
 */

type TestSet = {
  id: string;
  title: string;
  module: 1 | 2;
  difficulty: Difficulty;
  source_month: number | null;
  source_year: number | null;
  created_at: string;
  count: number;
  /** The student's own progress, from their sessions. Never another user's. */
  status: "new" | "in_progress" | "done";
  sessionId: string | null;
  score: { correct: number; total: number } | null;
  /** 0–100 completion from answered drafts or full completion. */
  progressPct: number;
};

/** One dated section of the browse list. Papers never share a card. */
type DateGroup = {
  key: string;
  label: string;
  papers: PaperGroup[];
};

/** Module 1 / Module 2 rows for a single paper title (e.g. "May 2024 V2"). */
type PaperGroup = {
  key: string;
  title: string;
  modules: TestSet[];
};

/**
 * Display order for the difficulty filter. The `sat_difficulty` enum carries both
 * the easy/medium/hard triple and the C/B/D/A/S letters real papers are graded
 * with, and a bank can hold either. Only the values actually present are offered
 * — a filter button that matches nothing is worse than no button.
 */
const DIFF_ORDER = ["easy", "medium", "hard", "C", "B", "D", "A", "S"];

type SortOrder = "shuffle" | "newest" | "oldest";
type StatusFilter = "all" | "new" | "in_progress" | "done";
type PaperStatus = "new" | "in_progress" | "done";

/** Stable pseudo-random order so cards do not jump on re-render. */
function shuffleStable<T>(items: T[], seed: string, keyFn: (item: T) => string): T[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    let ha = h;
    let hb = h;
    for (let i = 0; i < ka.length; i++) ha = (ha * 31 + ka.charCodeAt(i)) | 0;
    for (let i = 0; i < kb.length; i++) hb = (hb * 31 + kb.charCodeAt(i)) | 0;
    return ha - hb;
  });
}

function buildPaperGroups(sets: TestSet[], section: Section): PaperGroup[] {
  const map = new Map<string, PaperGroup>();
  for (const s of sets) {
    const pKey = paperKey(s.title, section);
    let paper = map.get(pKey);
    if (!paper) {
      paper = { key: pKey, title: stripModuleSuffix(s.title), modules: [] };
      map.set(pKey, paper);
    }
    paper.modules.push(s);
  }
  for (const paper of map.values()) {
    paper.modules.sort((a, b) => a.module - b.module || a.title.localeCompare(b.title));
  }
  return [...map.values()];
}

function paperDateKey(paper: PaperGroup): string {
  const sample = paper.modules[0];
  if (!sample) return "0000-00";
  const resolved = resolvePaperSourceDate(sample.title, sample.source_month, sample.source_year);
  return resolved ? paperDateSortKey(resolved.year, resolved.month) : "0000-00";
}

function paperDateLabel(paper: PaperGroup): string {
  const sample = paper.modules[0];
  if (!sample) return "Undated";
  return resolvePaperSourceDate(sample.title, sample.source_month, sample.source_year)?.label ?? "Undated";
}

function groupPapersByDate(papers: PaperGroup[]): DateGroup[] {
  const byDate = new Map<string, DateGroup>();
  for (const paper of papers) {
    const dateKey = paperDateKey(paper);
    const dateLabel = paperDateLabel(paper);
    let date = byDate.get(dateKey);
    if (!date) {
      date = { key: dateKey, label: dateLabel, papers: [] };
      byDate.set(dateKey, date);
    }
    date.papers.push(paper);
  }
  for (const date of byDate.values()) {
    date.papers.sort((a, b) => a.title.localeCompare(b.title));
  }
  return [...byDate.values()].sort((a, b) => {
    if (a.key === "0000-00") return 1;
    if (b.key === "0000-00") return -1;
    return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
  });
}

function paperStatus(paper: PaperGroup): PaperStatus {
  const mods = paper.modules;
  if (!mods.length) return "new";
  if (mods.every((m) => m.status === "done")) return "done";
  if (mods.some((m) => m.status === "in_progress" || m.status === "done")) return "in_progress";
  return "new";
}

function sortPapers(papers: PaperGroup[], sortOrder: SortOrder, seed: string): PaperGroup[] {
  if (sortOrder === "shuffle") return shuffleStable(papers, seed, (p) => p.key);
  return [...papers].sort((a, b) => {
    const ka = paperDateKey(a);
    const kb = paperDateKey(b);
    if (ka === "0000-00" && kb !== "0000-00") return 1;
    if (kb === "0000-00" && ka !== "0000-00") return -1;
    if (ka === kb) return a.title.localeCompare(b.title);
    return sortOrder === "newest" ? (ka < kb ? 1 : -1) : ka < kb ? -1 : 1;
  });
}

function parseSessionMetadata(raw: unknown): {
  test_id?: string;
  draft_answers?: AnswerState[] | null;
} | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as { test_id?: string; draft_answers?: AnswerState[] | null };
    } catch {
      return null;
    }
  }
  return raw as { test_id?: string; draft_answers?: AnswerState[] | null };
}

/** PostgREST `.in()` lists get long; chunk so a big bank never 400s the page. */
async function fetchQuestionCounts(testIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!testIds.length) return counts;

  const chunkSize = 40;
  for (let i = 0; i < testIds.length; i += chunkSize) {
    const chunk = testIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("test_questions")
      .select("test_id")
      .in("test_id", chunk);
    if (error) throw error;
    for (const row of (data ?? []) as { test_id: string }[]) {
      counts.set(row.test_id, (counts.get(row.test_id) ?? 0) + 1);
    }
  }
  return counts;
}

function mergeSets(
  rows: Omit<TestSet, "count" | "status" | "sessionId" | "score" | "progressPct">[],
  counts: Map<string, number>,
  byTest: Map<
    string,
    {
      id: string;
      completed_at: string | null;
      correct_count: number | null;
      total_questions: number | null;
      draft_answers: AnswerState[] | null | undefined;
    }
  >,
): TestSet[] {
  return rows
    .map((r) => {
      const s = byTest.get(r.id);
      const count = counts.get(r.id) ?? 0;
      const total = s?.total_questions ?? count;
      const completed = !!s?.completed_at;
      return {
        ...r,
        count,
        status: !s ? "new" : completed ? "done" : "in_progress",
        sessionId: s?.id ?? null,
        score:
          completed && s?.total_questions
            ? { correct: s.correct_count ?? 0, total: s.total_questions }
            : null,
        progressPct: s ? practiceSetProgressPct(completed, total, s.draft_answers) : 0,
      } as TestSet;
    })
    .filter((s) => s.count > 0);
}

function SectionBrowse() {
  const { section } = Route.useParams() as { section: Section };
  const navigate = useNavigate();

  const [sets, setSets] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [diffCounts, setDiffCounts] = useState<Record<string, number>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("all");
  const [paperDiffFilter, setPaperDiffFilter] = useState<Difficulty | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("shuffle");
  const [groupByDate, setGroupByDate] = useState(false);

  useEffect(() => {
    setFiltersOpen(false);
    setDateFilter("all");
    setPaperDiffFilter("all");
    setStatusFilter("all");
    setSortOrder("shuffle");
    setGroupByDate(false);
    setDiffFilter("all");
  }, [section]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setLoadError(null);
      setSets([]);

      try {
        const testsResult = await supabase
          .from("tests")
          .select("id,title,module,difficulty,source_month,source_year,created_at")
          .eq("section", section)
          .order("source_year", { ascending: false, nullsFirst: false })
          .order("source_month", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false });

        if (testsResult.error) throw testsResult.error;

        const rows = (testsResult.data ?? []) as Omit<
          TestSet,
          "count" | "status" | "sessionId" | "score" | "progressPct"
        >[];
        const ids = rows.map((r) => r.id);
        const counts = await fetchQuestionCounts(ids);

        if (cancelled) return;
        setSets(mergeSets(rows, counts, new Map()));
        setLoading(false);

        const [sessionsResult, countsResult] = await Promise.all([
          supabase
            .from("test_sessions")
            .select("id,metadata,completed_at,correct_count,total_questions,started_at")
            .eq("type", "practice")
            .order("started_at", { ascending: false })
            .limit(300),
          supabase.from("questions").select("difficulty").eq("section", section).limit(5000),
        ]);

        const byTest = new Map<
          string,
          {
            id: string;
            completed_at: string | null;
            correct_count: number | null;
            total_questions: number | null;
            draft_answers: AnswerState[] | null | undefined;
          }
        >();
        for (const s of (sessionsResult.data ?? []) as {
          id: string;
          metadata: unknown;
          completed_at: string | null;
          correct_count: number | null;
          total_questions: number | null;
        }[]) {
          const meta = parseSessionMetadata(s.metadata);
          const t = meta?.test_id;
          if (!t || byTest.has(t)) continue;
          byTest.set(t, {
            id: s.id,
            completed_at: s.completed_at,
            correct_count: s.correct_count,
            total_questions: s.total_questions,
            draft_answers: meta?.draft_answers,
          });
        }

        const diffTally: Record<string, number> = {};
        for (const row of (countsResult.data as { difficulty: string }[]) ?? []) {
          diffTally[row.difficulty] = (diffTally[row.difficulty] ?? 0) + 1;
        }

        if (cancelled) return;
        setSets(mergeSets(rows, counts, byTest));
        setDiffCounts(diffTally);
      } catch (e: unknown) {
        if (cancelled) return;
        setLoadError(errorMessage(e, "Could not load practice papers."));
        setSets([]);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [section]);

  const allPapers = useMemo(() => buildPaperGroups(sets, section), [sets, section]);

  const dateOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const paper of allPapers) {
      const key = paperDateKey(paper);
      if (!seen.has(key)) seen.set(key, paperDateLabel(paper));
    }
    return [...seen.entries()]
      .filter(([key]) => key !== "0000-00")
      .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
      .map(([key, label]) => ({ key, label }));
  }, [allPapers]);

  const hasActiveFilters =
    sortOrder !== "shuffle" ||
    statusFilter !== "all" ||
    groupByDate ||
    dateFilter !== "all" ||
    paperDiffFilter !== "all";

  const filteredPapers = useMemo(() => {
    let papers = allPapers;
    if (paperDiffFilter !== "all") {
      papers = papers.filter((paper) =>
        paper.modules.some((m) => m.difficulty === paperDiffFilter),
      );
    }
    if (dateFilter !== "all") {
      papers = papers.filter((paper) => paperDateKey(paper) === dateFilter);
    }
    if (statusFilter !== "all") {
      papers = papers.filter((paper) => paperStatus(paper) === statusFilter);
    }
    return sortPapers(papers, sortOrder, section);
  }, [allPapers, paperDiffFilter, dateFilter, statusFilter, sortOrder, section]);

  const flatPapers = useMemo(() => filteredPapers, [filteredPapers]);

  const groupedPapers = useMemo(
    () => (groupByDate ? groupPapersByDate(filteredPapers) : []),
    [filteredPapers, groupByDate],
  );

  const showGrouped = groupByDate;

  const difficulties = useMemo(
    () =>
      (Object.keys(diffCounts) as Difficulty[]).sort(
        (a, b) => DIFF_ORDER.indexOf(a) - DIFF_ORDER.indexOf(b),
      ),
    [diffCounts],
  );

  /**
   * Start, resume, or retake — all three are the same call.
   *
   * `startTestSetSession` returns the existing incomplete session if there is
   * one, so "Resume" lands back on the half-finished attempt with its answers
   * intact. A *completed* session doesn't match that check, so "Retake" gets a
   * fresh one and the old attempt stays in the student's history.
   */
  async function openSet(set: TestSet) {
    setStarting(set.id);
    try {
      const { sessionId } = await startTestSetSession(set.id);
      navigate({ to: `/practice/session/${sessionId}` });
    } catch (e: unknown) {
      alert(errorMessage(e, "Could not start this set."));
      setStarting(null);
    }
  }

  async function startMixed() {
    setStarting("mixed");
    try {
      const sessionId = await startPracticeSession({
        section,
        skill: null,
        difficulty: diffFilter === "all" ? null : (diffFilter as Difficulty),
        limit: 20,
      });
      navigate({ to: `/practice/session/${sessionId}` });
    } catch (e: unknown) {
      alert(errorMessage(e, "Could not start practice."));
      setStarting(null);
    }
  }

  const totalQuestions = Object.values(diffCounts).reduce((a, b) => a + b, 0);

  function clearFilters() {
    setDateFilter("all");
    setPaperDiffFilter("all");
    setStatusFilter("all");
    setSortOrder("shuffle");
    setGroupByDate(false);
    setDiffFilter("all");
  }

  return (
    <div className="space-y-5">
      <div className="rise-in flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => navigate({ to: "/practice" })}
            className="tap inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
            aria-label="Back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
              {SECTION_LABEL[section]}
            </h1>
            <p className="text-sm text-slate-500">
              {hasActiveFilters
                ? "Filtered view — adjust or clear filters below."
                : "Browse all papers in three columns. Open filters to sort by date or progress."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((open) => !open)}
          className={cn(
            "tap inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-bold shadow-panel transition-colors",
            hasActiveFilters || filtersOpen
              ? "border-brand-400 bg-brand-400 text-white"
              : "border-brand-400/40 bg-brand-600 text-white hover:bg-brand-400",
          )}
          aria-expanded={filtersOpen}
          aria-controls="practice-filters-panel"
        >
          <Filter className="h-4 w-4" />
          Filters
          <ChevronDown
            className={cn("h-4 w-4 transition-transform duration-300", filtersOpen && "rotate-180")}
          />
          {hasActiveFilters && (
            <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-[10px] font-bold tabular-nums">
              on
            </span>
          )}
        </button>
      </div>

      <div
        className={cn("practice-filters-drawer", filtersOpen && "practice-filters-drawer-open")}
        aria-hidden={!filtersOpen}
      >
        <div className="practice-filters-drawer-inner">
          <Panel as="section" id="practice-filters-panel" className="!p-4 shadow-float">
            <div className="flex flex-wrap items-start gap-x-8 gap-y-4">
              <FilterGroup label="Sort">
                <FilterChip
                  active={sortOrder === "shuffle"}
                  onClick={() => setSortOrder("shuffle")}
                  icon={Shuffle}
                >
                  Shuffled
                </FilterChip>
                <FilterChip
                  active={sortOrder === "newest"}
                  onClick={() => setSortOrder("newest")}
                  icon={ArrowDownWideNarrow}
                >
                  Newest
                </FilterChip>
                <FilterChip
                  active={sortOrder === "oldest"}
                  onClick={() => setSortOrder("oldest")}
                  icon={ArrowUpWideNarrow}
                >
                  Oldest
                </FilterChip>
              </FilterGroup>

              <FilterGroup label="Progress">
                <FilterChip active={statusFilter === "all"} onClick={() => setStatusFilter("all")}>
                  All
                </FilterChip>
                <FilterChip
                  active={statusFilter === "new"}
                  onClick={() => setStatusFilter("new")}
                  icon={Circle}
                >
                  Not started
                </FilterChip>
                <FilterChip
                  active={statusFilter === "in_progress"}
                  onClick={() => setStatusFilter("in_progress")}
                  icon={CircleDot}
                >
                  In progress
                </FilterChip>
                <FilterChip
                  active={statusFilter === "done"}
                  onClick={() => setStatusFilter("done")}
                  icon={CheckCircle2}
                >
                  Completed
                </FilterChip>
              </FilterGroup>

              <FilterGroup label="Difficulty">
                <FilterChip
                  active={paperDiffFilter === "all"}
                  onClick={() => setPaperDiffFilter("all")}
                >
                  All
                </FilterChip>
                {difficulties.map((d) => (
                  <FilterChip
                    key={`paper-${d}`}
                    active={paperDiffFilter === d}
                    onClick={() => setPaperDiffFilter(d)}
                  >
                    {difficultyLabel(d)}
                  </FilterChip>
                ))}
              </FilterGroup>

              <FilterGroup label="Group">
                <FilterChip active={groupByDate} onClick={() => setGroupByDate((v) => !v)}>
                  By date
                </FilterChip>
              </FilterGroup>

              {hasActiveFilters && (
                <div className="flex items-end self-stretch pb-0.5">
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="tap rounded-lg border border-brand-400/50 px-3 py-1.5 text-xs font-bold text-brand-100 hover:bg-brand-800 hover:text-white"
                  >
                    Clear all
                  </button>
                </div>
              )}
            </div>

            {dateOptions.length > 0 && (
              <div className="mt-4 border-t border-brand-400/30 pt-4">
                <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  Paper date
                </div>
                <div className="scroll-area flex gap-2 overflow-x-auto pb-1">
                  <FilterChip
                    active={dateFilter === "all"}
                    onClick={() => setDateFilter("all")}
                    compact
                  >
                    All dates
                  </FilterChip>
                  {dateOptions.map((opt) => (
                    <FilterChip
                      key={opt.key}
                      active={dateFilter === opt.key}
                      onClick={() => setDateFilter(opt.key)}
                      compact
                    >
                      {opt.label}
                    </FilterChip>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-brand-400/30 pt-4">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
                <Layers className="h-4 w-4" /> Mixed practice
              </div>
              <div className="flex flex-wrap gap-2">
                <FilterChip active={diffFilter === "all"} onClick={() => setDiffFilter("all")} compact>
                  All levels
                </FilterChip>
                {difficulties.map((d) => (
                  <FilterChip
                    key={`mixed-${d}`}
                    active={diffFilter === d}
                    onClick={() => setDiffFilter(d)}
                    compact
                  >
                    {difficultyLabel(d)}
                    <span className="ml-1 tabular-nums opacity-70">{diffCounts[d]}</span>
                  </FilterChip>
                ))}
              </div>
              <button
                type="button"
                onClick={startMixed}
                disabled={totalQuestions === 0 || starting != null}
                className="btn-brand ml-auto inline-flex items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {starting === "mixed" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Layers className="h-4 w-4" />
                )}
                Start mixed
              </button>
            </div>
          </Panel>
        </div>
      </div>

      <div>
        {loadError ? (
          <EmptyState
            title="Could not load papers"
            body={loadError}
            className="py-14"
          />
        ) : loading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />
            ))}
          </div>
        ) : allPapers.length === 0 ? (
          <EmptyState
            title="No practice sets yet"
            body="Admins haven't published a paper for this section yet."
            className="py-14"
          />
        ) : showGrouped ? (
          groupedPapers.length === 0 ? (
            <EmptyState
              title="No papers match"
              body="Try clearing or changing your filters."
              className="py-14"
            />
          ) : (
            <div className="space-y-6">
              {groupedPapers.map((g) => (
                <section key={g.key}>
                  <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {g.label}
                    <span className="tabular-nums text-slate-400">
                      · {g.papers.length} paper{g.papers.length === 1 ? "" : "s"}
                    </span>
                  </h2>
                  <div className="stagger-fast grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {g.papers.map((paper) => (
                      <PaperCard
                        key={paper.key}
                        paper={paper}
                        starting={starting}
                        onOpen={openSet}
                        onReview={(sessionId) =>
                          navigate({ to: `/analysis/session/${sessionId}` })
                        }
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )
        ) : flatPapers.length === 0 ? (
          <EmptyState
            title="No papers match"
            body="Try clearing or changing your filters."
            className="py-14"
          />
        ) : (
          <div className="stagger-fast grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {flatPapers.map((paper) => (
              <PaperCard
                key={paper.key}
                paper={paper}
                starting={starting}
                onOpen={openSet}
                onReview={(sessionId) => navigate({ to: `/analysis/session/${sessionId}` })}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  children,
  icon: Icon,
  compact,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  icon?: ComponentType<{ className?: string }>;
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "tap inline-flex shrink-0 items-center gap-1.5 rounded-full border font-semibold transition-colors",
        compact ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        active
          ? "border-brand-300 bg-brand-400 text-white shadow-brand"
          : "border-brand-400/40 bg-brand-800 text-brand-100 hover:border-brand-300 hover:bg-brand-700 hover:text-white",
      )}
    >
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  );
}

function moduleProgress(set: TestSet | undefined): number {
  return set?.progressPct ?? 0;
}

function ProgressRing({ value }: { value: number }) {
  const r = 15;
  const size = 44;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      aria-label={`${value}% complete`}
    >
      <svg
        className="-rotate-90"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          className="text-brand-400/30"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          className="text-brand-300 transition-[stroke-dashoffset] duration-300"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-bold tabular-nums leading-none text-white">
        {value}%
      </span>
    </div>
  );
}

function primaryModuleSet(rows: TestSet[]): TestSet | undefined {
  return (
    rows.find((s) => s.status === "in_progress") ??
    rows.find((s) => s.status === "done") ??
    rows[0]
  );
}

function PaperCard({
  paper,
  starting,
  onOpen,
  onReview,
}: {
  paper: PaperGroup;
  starting: string | null;
  onOpen: (set: TestSet) => void;
  onReview: (sessionId: string) => void;
}) {
  const mod1 = primaryModuleSet(paper.modules.filter((s) => s.module === 1));
  const mod2 = primaryModuleSet(paper.modules.filter((s) => s.module === 2));
  const progress = Math.round((moduleProgress(mod1) + moduleProgress(mod2)) / 2);

  return (
    <RevealCard className="flex aspect-[4/3] flex-col overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel lift">
      <div className="flex shrink-0 items-start justify-between gap-2 px-3.5 pt-3.5 pb-1.5">
        <h3 className="line-clamp-2 text-sm font-black uppercase leading-tight tracking-wide text-white">
          {paper.title}
        </h3>
        <ProgressRing value={progress} />
      </div>
      <div className="flex min-h-0 flex-1 flex-col gap-2 px-3.5 pb-3.5 pt-1">
        {([1, 2] as const).map((mod) => (
          <ModuleRow
            key={mod}
            mod={mod}
            set={mod === 1 ? mod1 : mod2}
            starting={starting}
            onOpen={onOpen}
            onReview={onReview}
          />
        ))}
      </div>
    </RevealCard>
  );
}

function ModuleRow({
  mod,
  set,
  starting,
  onOpen,
  onReview,
}: {
  mod: 1 | 2;
  set: TestSet | undefined;
  starting: string | null;
  onOpen: (set: TestSet) => void;
  onReview: (sessionId: string) => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 items-stretch overflow-hidden rounded-xl border border-brand-400/30 bg-brand-800/70">
      <div className="my-2.5 ml-2 w-1.5 shrink-0 rounded-full bg-brand-400" aria-hidden />
      {!set ? (
        <div className="flex min-w-0 flex-1 items-center px-3 py-2.5">
          <p className="text-sm font-bold text-white">Module {mod}</p>
          <span className="ml-auto text-xs text-brand-200">—</span>
        </div>
      ) : (
        <ModuleRowBody set={set} mod={mod} starting={starting} onOpen={onOpen} onReview={onReview} />
      )}
    </div>
  );
}

function ModuleRowBody({
  set,
  mod,
  starting,
  onOpen,
  onReview,
}: {
  set: TestSet;
  mod: 1 | 2;
  starting: string | null;
  onOpen: (set: TestSet) => void;
  onReview: (sessionId: string) => void;
}) {
  const busy = starting === set.id;
  const disabled = starting != null && starting !== set.id;
  const label =
    set.status === "done" ? "Retake" : set.status === "in_progress" ? "Resume" : "Start";
  const Icon = set.status === "done" ? RotateCcw : Play;

  const pct = set.progressPct;

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-bold text-white">Module {mod}</p>
          {pct > 0 && (
            <span className="shrink-0 rounded-full bg-brand-400/25 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-100">
              {pct}%
            </span>
          )}
        </div>
        <p className="truncate text-xs font-medium text-brand-100">
          {set.count}Q · {difficultyLabel(set.difficulty)}
          {set.status === "in_progress" ? " · In progress" : ""}
          {set.score ? ` · ${set.score.correct}/${set.score.total}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        {set.status === "done" && set.sessionId && (
          <button
            onClick={() => onReview(set.sessionId!)}
            disabled={busy || disabled}
            className="tap inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-400/50 bg-brand-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-brand-500 disabled:opacity-40"
          >
            <BookOpenCheck className="h-3.5 w-3.5" />
            Review
          </button>
        )}
        <button
          onClick={() => onOpen(set)}
          disabled={busy || disabled}
          className="btn-brand inline-flex items-center justify-center gap-1.5 rounded-full bg-brand-400 px-3.5 py-1.5 text-xs font-bold text-white shadow-brand disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Icon className="h-3.5 w-3.5" />}
          {label}
        </button>
      </div>
    </div>
  );
}
