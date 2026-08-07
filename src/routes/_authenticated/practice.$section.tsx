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
  skillsFor,
  formatSourceDate,
  difficultyLabel,
  type Section,
  type Difficulty,
} from "@/lib/sat";
import { startPracticeSession, startTestSetSession } from "@/lib/session";
import { Panel, EmptyState } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";

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
  count: number;
  /** The student's own progress, from their sessions. Never another user's. */
  status: "new" | "in_progress" | "done";
  sessionId: string | null;
  score: { correct: number; total: number } | null;
};

type Group = { key: string; label: string; sets: TestSet[] };

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
  const skills = skillsFor(section);

  const [sets, setSets] = useState<TestSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState<string | null>(null);

  // Mixed practice — the old filter behaviour, kept reachable.
  const [skillFilter, setSkillFilter] = useState<string | "all">("all");
  const [diffFilter, setDiffFilter] = useState<Difficulty | "all">("all");
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});
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
          .select("id,title,module,difficulty,source_month,source_year")
          .eq("section", section)
          .order("source_year", { ascending: false, nullsFirst: false })
          .order("source_month", { ascending: false, nullsFirst: false })
          .order("created_at", { ascending: false }),
        /* Tallies for the mixed-practice panel. `skill` and `difficulty` only —
           deliberately not `question_text`, which is the whole point of this
           rewrite. Past 5,000 questions the counts become a floor rather than a
           total; they label filter buttons, so that is acceptable. */
        supabase.from("questions").select("skill,difficulty").eq("section", section).limit(5000),
      ]);

      const rows = (testsResult.data ?? []) as Omit<TestSet, "count" | "status" | "sessionId" | "score">[];
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
        { id: string; completed_at: string | null; correct_count: number | null; total_questions: number | null }
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

      const skillTally: Record<string, number> = {};
      const diffTally: Record<string, number> = {};
      for (const row of (countsResult.data as { skill: string; difficulty: string }[]) ?? []) {
        skillTally[row.skill] = (skillTally[row.skill] ?? 0) + 1;
        diffTally[row.difficulty] = (diffTally[row.difficulty] ?? 0) + 1;
      }

      if (cancelled) return;
      setSets(built.filter((s) => s.count > 0));
      setSkillCounts(skillTally);
      setDiffCounts(diffTally);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [section]);

  /* Grouped by the date printed on the paper, newest first. A set with no date
     goes to "Unsorted" at the bottom rather than disappearing — an undated set is
     an admin oversight, and hiding it makes the oversight invisible.

     Undated sets take the key "0000-00" so that the single descending sort puts
     them last. A sentinel like "zzz" would sort *first*, which is exactly
     backwards. */
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const s of sets) {
      const label = formatSourceDate(s.source_month, s.source_year);
      const key = label ? `${s.source_year}-${String(s.source_month).padStart(2, "0")}` : "0000-00";
      if (!map.has(key)) map.set(key, { key, label: label ?? "Unsorted", sets: [] });
      map.get(key)!.sets.push(s);
    }
    return [...map.values()].sort((a, b) => (a.key < b.key ? 1 : a.key > b.key ? -1 : 0));
  }, [sets]);

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
    } catch (e: any) {
      alert(e?.message ?? "Could not start this set.");
      setStarting(null);
    }
  }

  async function startMixed() {
    setStarting("mixed");
    try {
      const sessionId = await startPracticeSession({
        section,
        skill: skillFilter === "all" ? null : skillFilter,
        difficulty: diffFilter === "all" ? null : (diffFilter as Difficulty),
        limit: 20,
      });
      navigate({ to: `/practice/session/${sessionId}` });
    } catch (e: any) {
      alert(e?.message ?? "Could not start practice.");
      setStarting(null);
    }
  }

  const totalQuestions = Object.values(skillCounts).reduce((a, b) => a + b, 0);

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
            Pick a paper by date, or build a mixed set from the whole bank.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[280px_1fr]">
        {/* Mixed practice — the old skill/difficulty filters, still reachable. */}
        <Panel as="section" className="h-fit">
          <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand-100">
            <Filter className="h-4 w-4" /> Mixed practice
          </div>
          <p className="mb-3 text-[11px] leading-relaxed text-brand-200">
            20 questions drawn from every paper, newest first.
          </p>

          <div className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-bold text-white">Skill</div>
              <div className="space-y-1">
                <FilterRow
                  label="All skills"
                  count={totalQuestions}
                  active={skillFilter === "all"}
                  onClick={() => setSkillFilter("all")}
                />
                {skills.map((s) => (
                  <FilterRow
                    key={s}
                    label={s}
                    count={skillCounts[s] ?? 0}
                    active={skillFilter === s}
                    onClick={() => setSkillFilter(s)}
                  />
                ))}
              </div>
            </div>

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
                    · {g.sets.length} set{g.sets.length === 1 ? "" : "s"}
                  </span>
                </h2>
                <ul className="stagger-fast grid gap-3 sm:grid-cols-2">
                  {g.sets.map((s) => (
                    <SetCard
                      key={s.id}
                      set={s}
                      busy={starting === s.id}
                      disabled={starting != null && starting !== s.id}
                      onOpen={() => openSet(s)}
                      onReview={
                        s.status === "done" && s.sessionId
                          ? () => navigate({ to: `/analysis/session/${s.sessionId}` })
                          : undefined
                      }
                    />
                  ))}
                </ul>
              </section>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function SetCard({
  set,
  busy,
  disabled,
  onOpen,
  onReview,
}: {
  set: TestSet;
  busy: boolean;
  disabled: boolean;
  onOpen: () => void;
  /** Only supplied for a completed set — reviewing needs a session to review. */
  onReview?: () => void;
}) {
  const label =
    set.status === "done" ? "Retake" : set.status === "in_progress" ? "Resume" : "Start";
  const Icon = set.status === "done" ? RotateCcw : Play;

  return (
    <li className="flex flex-col justify-between gap-3 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 shadow-panel transition hover:bg-brand-500">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-white">{set.title}</h3>
          {set.status === "done" && (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" aria-label="Completed" />
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
            {set.count} question{set.count === 1 ? "" : "s"}
          </span>
          <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
            Module {set.module}
          </span>
          <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
            Difficulty <span className="text-white">{difficultyLabel(set.difficulty)}</span>
          </span>
        </div>
        {set.score && (
          <div className="mt-2 text-[11px] font-semibold text-brand-100">
            Last attempt:{" "}
            <span className="tabular-nums text-white">
              {set.score.correct}/{set.score.total}
            </span>
          </div>
        )}
        {set.status === "in_progress" && (
          <div className="mt-2 text-[11px] font-semibold text-brand-100">In progress</div>
        )}
      </div>

      <div className="flex gap-2">
        {onReview && (
          <button
            onClick={onReview}
            disabled={busy || disabled}
            className="tap inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-800 px-3 py-2 text-sm font-bold text-white hover:bg-brand-400 disabled:opacity-40"
          >
            <BookOpenCheck className="h-4 w-4" />
            Review
          </button>
        )}
        <button
          onClick={onOpen}
          disabled={busy || disabled}
          className="btn-brand inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-brand-400 px-3 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
          {label}
        </button>
      </div>
    </li>
  );
}

function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "tap flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-xs font-semibold " +
        (active
          ? "bg-brand-400 text-white shadow-brand"
          : "text-brand-100 hover:bg-brand-800 hover:text-white")
      }
    >
      <span className="truncate">{label}</span>
      <span className="tabular-nums text-brand-200">{count}</span>
    </button>
  );
}
