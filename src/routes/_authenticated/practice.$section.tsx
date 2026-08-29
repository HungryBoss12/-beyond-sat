import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Filter,
  Play,
  Loader2,
  CalendarDays,
  CheckCircle2,
  RotateCcw,
  Layers,
  BookOpenCheck,
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
import { Panel, EmptyState } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";
import { errorMessage } from "@/lib/utils";

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

function SectionBrowse() {
  const { section } = Route.useParams() as { section: Section };
  const navigate = useNavigate();

  const [sets, setSets] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [diffCounts, setDiffCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);

      const [testsResult, countsResult] = await Promise.all([
        /* `published` is deliberately not filtered here. The read policy in
           PRACTICE_SETS.sql already hides unpublished sets from students, and
           naming the column client-side would 400 the whole page on any project
           where that migration hasn't been applied yet. */
        supabase
          .from("tests")
          .select("id,title,module,difficulty,source_month,source_year,created_at")
          .eq("section", section)
          .order("source_year", { ascending: false, nullsFirst: false })
          .order("source_month", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        /* Tallies for the mixed-practice panel. Difficulty only — deliberately
           not `question_text`. Past 5,000 questions the counts become a floor
           rather than a total; they label filter buttons, so that is acceptable. */
        supabase.from("questions").select("difficulty").eq("section", section).limit(5000),
      ]);

      const rows = (testsResult.data ?? []) as Omit<
        TestSet,
        "count" | "status" | "sessionId" | "score"
      >[];
      const ids = rows.map((r) => r.id);

      /* Question counts and the student's sessions in two queries rather than one
         per card: a page of 30 sets would otherwise be 60 round trips. */
      const [linksResult, sessionsResult] = await Promise.all([
        ids.length
          ? supabase.from("test_questions").select("test_id,question_id").in("test_id", ids)
          : Promise.resolve({ data: [] as { test_id: string; question_id: string }[] }),
        supabase
          .from("test_sessions")
          .select("id,metadata,completed_at,correct_count,total_questions,started_at")
          .eq("type", "practice")
          .order("started_at", { ascending: false })
          .limit(300),
      ]);

      const counts = new Map<string, number>();
      for (const l of (linksResult.data ?? []) as { test_id: string }[]) {
        counts.set(l.test_id, (counts.get(l.test_id) ?? 0) + 1);
      }

      /* Newest session per set wins — the list is already sorted by
         `started_at` descending, so the first hit for a test id is the current
         one. RLS scopes `test_sessions` to the signed-in student, so this is
         their own progress and nobody else's. */
      const byTest = new Map<
        string,
        {
          id: string;
          completed_at: string | null;
          correct_count: number | null;
          total_questions: number | null;
        }
      >();
      for (const s of (sessionsResult.data ?? []) as {
        id: string;
        metadata: { test_id?: string } | null;
        completed_at: string | null;
        correct_count: number | null;
        total_questions: number | null;
      }[]) {
        const t = s.metadata?.test_id;
        if (!t || byTest.has(t)) continue;
        byTest.set(t, {
          id: s.id,
          completed_at: s.completed_at,
          correct_count: s.correct_count,
          total_questions: s.total_questions,
        });
      }

      const built: TestSet[] = rows.map((r) => {
        const s = byTest.get(r.id);
        return {
          ...r,
          count: counts.get(r.id) ?? 0,
          status: !s ? "new" : s.completed_at ? "done" : "in_progress",
          sessionId: s?.id ?? null,
          score:
            s?.completed_at && s.total_questions
              ? { correct: s.correct_count ?? 0, total: s.total_questions }
              : null,
        };
      });

      const diffTally: Record<string, number> = {};
      for (const row of (countsResult.data as { difficulty: string }[]) ?? []) {
        diffTally[row.difficulty] = (diffTally[row.difficulty] ?? 0) + 1;
      }

      if (cancelled) return;
      setSets(built.filter((s) => s.count > 0));
      setDiffCounts(diffTally);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  /* Date → paper → modules. Newest year/month first; within a date, newest
     `created_at` first. Titles without source fields still get a date when the
     name carries a year/month (e.g. "2025 June E"). Truly undated land last. */
  const groups = useMemo<DateGroup[]>(() => {
    const byDate = new Map<string, DateGroup>();
    for (const s of sets) {
      const resolved = resolvePaperSourceDate(s.title, s.source_month, s.source_year);
      const dateKey = resolved ? paperDateSortKey(resolved.year, resolved.month) : "0000-00";
      const dateLabel = resolved?.label ?? "Unsorted";
      let date = byDate.get(dateKey);
      if (!date) {
        date = { key: dateKey, label: dateLabel, papers: [] };
        byDate.set(dateKey, date);
      }

      const pKey = paperKey(s.title, section);
      let paper = date.papers.find((p) => p.key === pKey);
      if (!paper) {
        paper = { key: pKey, title: stripModuleSuffix(s.title), modules: [] };
        date.papers.push(paper);
      }
      paper.modules.push(s);
    }

    function newestAdded(paper: PaperGroup): number {
      let max = 0;
      for (const m of paper.modules) {
        const t = Date.parse(m.created_at);
        if (!Number.isNaN(t) && t > max) max = t;
      }
      return max;
    }

    for (const date of byDate.values()) {
      for (const paper of date.papers) {
        paper.modules.sort((a, b) => a.module - b.module || a.title.localeCompare(b.title));
      }
      date.papers.sort((a, b) => newestAdded(b) - newestAdded(a) || a.title.localeCompare(b.title));
    }

    return [...byDate.values()].sort((a, b) => {
      if (a.key === "0000-00") return 1;
      if (b.key === "0000-00") return -1;
      return a.key < b.key ? 1 : a.key > b.key ? -1 : 0;
    });
  }, [sets, section]);

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

  return (
    <div className="space-y-5">
      <div className="rise-in flex items-center gap-3">
        <button
          onClick={() => navigate({ to: "/practice" })}
          className="tap inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-600 text-white shadow-panel hover:bg-brand-400"
          aria-label="Back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          {/* Sits on the white page background, so this heading stays dark. */}
          <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-3xl">
            {SECTION_LABEL[section]}
          </h1>
          <p className="text-sm text-slate-500">
            Newest papers first (by year, then when they were added). Module 1 and Module 2 stay
            under their own paper.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        <Panel as="section" className="h-fit">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
            <Filter className="h-4 w-4" /> Mixed practice
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-brand-200">
            20 questions drawn from every paper, newest first.
          </p>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-bold text-white">Difficulty</div>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  onClick={() => setDiffFilter("all")}
                  className={
                    "tap rounded-md px-2 py-1.5 text-xs font-semibold " +
                    (diffFilter === "all"
                      ? "bg-brand-400 text-white shadow-brand"
                      : "bg-brand-800 text-brand-100 hover:bg-brand-400 hover:text-white")
                  }
                >
                  All
                </button>
                {difficulties.map((d) => (
                  <button
                    key={d}
                    onClick={() => setDiffFilter(d)}
                    className={
                      "tap rounded-md px-2 py-1.5 text-xs font-semibold " +
                      (diffFilter === d
                        ? "bg-brand-400 text-white shadow-brand"
                        : "bg-brand-800 text-brand-100 hover:bg-brand-400 hover:text-white")
                    }
                  >
                    {difficultyLabel(d)}
                    <span className="ml-1 tabular-nums text-brand-200">{diffCounts[d]}</span>
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={startMixed}
              disabled={totalQuestions === 0 || starting != null}
              className="btn-brand inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              {starting === "mixed" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Layers className="h-4 w-4" />
              )}
              Start mixed practice
            </button>
          </div>
        </Panel>

        {/* Dated sets */}
        <div className="space-y-6">
          {loading ? (
            <ListSkeleton rows={6} />
          ) : groups.length === 0 ? (
            <EmptyState
              title="No practice sets yet"
              body="Admins haven't published a paper for this section. Mixed practice on the left still works if there are questions in the bank."
              className="py-14"
            />
          ) : (
            groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                  <CalendarDays className="h-3.5 w-3.5" />
                  {g.label}
                  <span className="tabular-nums text-slate-400">
                    · {g.papers.length} paper{g.papers.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <div className="stagger-fast space-y-3">
                  {g.papers.map((paper) => (
                    <PaperCard
                      key={paper.key}
                      paper={paper}
                      starting={starting}
                      onOpen={openSet}
                      onReview={(sessionId) => navigate({ to: `/analysis/session/${sessionId}` })}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
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
  const mod1 = paper.modules.filter((s) => s.module === 1);
  const mod2 = paper.modules.filter((s) => s.module === 2);

  return (
    <div className="overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
      <div className="border-b border-brand-400/30 px-4 py-3">
        <h3 className="text-sm font-bold text-white">{paper.title}</h3>
      </div>
      {/* Modules stack in one column so Module 1 sits above Module 2. */}
      <div className="flex flex-col gap-3 p-3">
        {([1, 2] as const).map((mod) => {
          const rows = mod === 1 ? mod1 : mod2;
          return (
            <div
              key={mod}
              className="overflow-hidden rounded-xl border border-brand-400/30 border-l-4 border-l-brand-400 bg-brand-800/50"
            >
              <div className="border-b border-brand-400/20 px-4 py-2 text-[10px] font-bold uppercase tracking-wider text-brand-200">
                Module {mod}
              </div>
              {rows.length === 0 ? (
                <div className="px-4 py-3 text-xs text-brand-200">Not available</div>
              ) : (
                <ul>
                  {rows.map((set) => {
                    const busy = starting === set.id;
                    const disabled = starting != null && starting !== set.id;
                    const label =
                      set.status === "done"
                        ? "Retake"
                        : set.status === "in_progress"
                          ? "Resume"
                          : "Start";
                    const Icon = set.status === "done" ? RotateCcw : Play;
                    return (
                      <li
                        key={set.id}
                        className="flex flex-col gap-3 px-4 py-3 transition-colors hover:bg-brand-500/40"
                      >
                        <div className="flex flex-wrap items-center gap-1.5">
                          {set.status === "done" && (
                            <CheckCircle2
                              className="h-3.5 w-3.5 text-brand-200"
                              aria-label="Completed"
                            />
                          )}
                          {set.status === "in_progress" && (
                            <span className="text-[11px] font-semibold text-brand-100">
                              In progress
                            </span>
                          )}
                          <span className="rounded bg-brand-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                            {set.count} question{set.count === 1 ? "" : "s"}
                          </span>
                          <span className="rounded bg-brand-900/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                            Difficulty{" "}
                            <span className="text-white">{difficultyLabel(set.difficulty)}</span>
                          </span>
                          {set.score && (
                            <span className="text-[11px] font-semibold text-brand-100">
                              Last:{" "}
                              <span className="tabular-nums text-white">
                                {set.score.correct}/{set.score.total}
                              </span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          {set.status === "done" && set.sessionId && (
                            <button
                              onClick={() => onReview(set.sessionId!)}
                              disabled={busy || disabled}
                              className="tap inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-900/70 px-3 py-2.5 text-sm font-bold text-white hover:bg-brand-400 disabled:opacity-40"
                            >
                              <BookOpenCheck className="h-4 w-4" />
                              Review
                            </button>
                          )}
                          <button
                            onClick={() => onOpen(set)}
                            disabled={busy || disabled}
                            className="btn-brand inline-flex flex-1 items-center justify-center gap-1.5 rounded-full bg-brand-400 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-40"
                          >
                            {busy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Icon className="h-4 w-4" />
                            )}
                            {label}
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
