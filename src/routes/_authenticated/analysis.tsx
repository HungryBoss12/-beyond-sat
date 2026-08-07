import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  BarChart3,
  ChevronRight,
  CheckCircle2,
  XCircle,
  Target,
  Gauge,
  Calculator,
  RotateCcw,
} from "lucide-react";
import {
  RW_SKILLS,
  MATH_SKILLS,
  LETTER_DIFFICULTIES,
  SECTION_LABEL,
  difficultyColor,
  difficultyLabel,
  estimateScore,
  scoreBand,
  scoreProgress,
  RW_QUESTION_COUNT,
  MATH_QUESTION_COUNT,
  type Section,
  type Difficulty,
} from "@/lib/sat";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { PageHead, Panel, Skeleton } from "@/components/ui/panel";
import { HeadSkeleton, ListSkeleton, StatRowSkeleton } from "@/components/ui/skeletons";
import { Badge, Delta, type Tone } from "@/components/ui/metric";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/analysis")({
  component: AnalysisPage,
  head: () => ({ meta: [{ title: "Analysis — BeyondSAT" }] }),
});

type SessionRow = {
  id: string;
  type: "practice" | "daily" | "mock";
  started_at: string;
  completed_at: string | null;
  correct_count: number | null;
  total_questions: number | null;
  score: number | null;
  rw_score: number | null;
  math_score: number | null;
};

type AttemptRow = {
  id: string;
  session_id: string;
  question_id: string;
  is_correct: boolean | null;
  selected_choice_id: string | null;
  grid_answer: string | null;
};

/* The chat that used to sit under the score counters now has its own section at
   /beyond-ai. `buildAiContext` moved with it, to src/lib/ai/context.ts — the
   first reply is still specific to the student's own numbers. */

type QuestionLite = {
  id: string;
  section: Section;
  skill: string;
  difficulty: Difficulty;
  kind: "multiple_choice" | "grid_in";
  question_text: string;
  choices: { id: string; text: string }[] | null;
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
  created_at: string;
};

function AnalysisPage() {
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [openSession, setOpenSession] = useState<string | null>(null);

  const [fSection, setFSection] = useState<Section | "all">("all");
  const [fSkill, setFSkill] = useState<string>("");
  const [fDifficulty, setFDifficulty] = useState<Difficulty | "">("");
  const [fFrom, setFFrom] = useState("");
  const [fTo, setFTo] = useState("");

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) return;
      const [{ data: s }, { data: a }, { count }] = await Promise.all([
        supabase
          .from("test_sessions")
          .select("id,type,started_at,completed_at,correct_count,total_questions,score,rw_score,math_score")
          .eq("user_id", uid)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false }),
        supabase
          .from("attempts")
          .select("id,session_id,question_id,is_correct,selected_choice_id,grid_answer")
          .eq("user_id", uid),
        supabase.from("tests").select("*", { count: "exact", head: true }),
      ]);
      setSessions((s ?? []) as SessionRow[]);
      setAttempts((a ?? []) as AttemptRow[]);
      setTotalAvailable(count ?? 0);
      setLoading(false);
    })();
  }, []);

  const totals = useMemo(() => {
    let correct = 0;
    let wrong = 0;
    for (const a of attempts) {
      if (a.is_correct === true) correct += 1;
      else if (a.is_correct === false) wrong += 1;
    }
    return { correct, wrong, total: correct + wrong };
  }, [attempts]);

  /**
   * Score counters, driven by completed mock exams only — practice and daily
   * sets aren't full-length so they don't produce a valid 400-1600 score.
   * With no mocks taken, every counter reads 0 rather than the 400 scale floor.
   */
  const scores = useMemo(() => {
    const mocks = sessions.filter(
      (s) => s.type === "mock" && s.score != null,
    ) as (SessionRow & { score: number })[];
    if (mocks.length === 0) {
      return { latest: 0, average: 0, best: 0, count: 0, rw: 0, math: 0, delta: null as number | null };
    }
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rwVals = mocks.map((m) => m.rw_score).filter((v): v is number => v != null);
    const mathVals = mocks.map((m) => m.math_score).filter((v): v is number => v != null);
    return {
      latest: mocks[0].score,
      average: Math.round(mean(mocks.map((m) => m.score))),
      best: Math.max(...mocks.map((m) => m.score)),
      count: mocks.length,
      rw: rwVals.length ? Math.round(mean(rwVals)) : 0,
      math: mathVals.length ? Math.round(mean(mathVals)) : 0,
      delta: mocks[1]?.score != null ? mocks[0].score - mocks[1].score : null,
    };
  }, [sessions]);

  /* Recharts takes literal colours, not tokens, so these are the brand ramp's
     hexes by hand: the light #9f9fc2 for correct, the deepest #0d0d4c for
     wrong. Both sit on the #0b0761 card, so they read as two ends of the ramp
     rather than needing green and red.

     "Correct" pulls from the derived light steps rather than one of the five
     brand indigos: those are all within a few percent of the card's own
     lightness, so a slice in any of them would be invisible. */
  const pieData = [
    { name: "Correct", value: totals.correct, color: "#9f9fc2" },
    { name: "Wrong", value: totals.wrong, color: "#0d0d4c" },
  ];

  const completedCount = sessions.length;
  const completionPct = totalAvailable > 0 ? Math.min(100, Math.round((completedCount / totalAvailable) * 100)) : 0;

  const skillOptions = fSection === "reading_writing" ? RW_SKILLS : fSection === "math" ? MATH_SKILLS : [...RW_SKILLS, ...MATH_SKILLS];

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (fFrom && s.completed_at && s.completed_at < fFrom) return false;
      if (fTo && s.completed_at && s.completed_at > `${fTo}T23:59:59`) return false;
      return true;
    });
  }, [sessions, fFrom, fTo]);

  /* Skeleton mirrors the real layout below — heading, three score counters,
     calculator, stat row, chart, filter bar, session list — so the page settles
     into place instead of jumping from a spinner to a full screen of content. */
  if (loading) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-[190px] rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-[220px] rounded-2xl" />
        <StatRowSkeleton count={3} />
        <Skeleton className="h-[320px] rounded-2xl" />
        <Skeleton className="h-[84px] rounded-2xl" />
        <ListSkeleton rows={5} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHead
        title="Analysis"
        subtitle="Review your progress and dig into every completed test."
      />

      {/* Score counters — driven by completed mock exams */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ScoreCounter
          label="Current score"
          value={scores.latest}
          delta={scores.delta}
          hint={
            scores.count === 0
              ? "Take a mock exam to get your score"
              : `From your latest of ${scores.count} mock${scores.count === 1 ? "" : "s"}`
          }
          emphasis
        />
        <ScoreCounter
          label="Average score"
          value={scores.average}
          hint={
            scores.count === 0
              ? "No mock exams yet"
              : `R&W ${scores.rw || "—"} · Math ${scores.math || "—"}`
          }
        />
        <ScoreCounter
          label="Best score"
          value={scores.best}
          hint={scores.count === 0 ? "No mock exams yet" : "Your personal record"}
        />
      </div>

      <ScoreCalculator />

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 stagger">
        <StatCard label="Tests completed" value={completedCount} icon={<BarChart3 className="h-5 w-5" />} />
        <StatCard
          label="Completion progress"
          value={`${completionPct}%`}
          hint={`${completedCount} of ${totalAvailable} available`}
        />
        <StatCard
          label="Answers"
          value={totals.total}
          hint={`${totals.correct} correct · ${totals.wrong} wrong`}
        />
      </div>

      <Panel className="rise-in">
        <h2 className="mb-2 text-lg font-black tracking-tight text-white">Correct vs. wrong</h2>
        {totals.total === 0 ? (
          <div className="py-10 text-center text-sm text-brand-100">
            No answers yet — complete a practice test to see your breakdown.
          </div>
        ) : (
          /* Recharts renders its slice labels and legend text with its own dark
             defaults, which disappear on the brand card — the two arbitrary
             variants force them white since there's no prop for either. */
          <div className="h-64 [&_.recharts-legend-item-text]:!text-white [&_.recharts-pie-label-text]:fill-white">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={pieData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={90}
                  paddingAngle={2}
                  animationDuration={900}
                  labelLine={{ stroke: "#9f9fc2" }}
                  label={(e: any) => `${e.name}: ${e.value} (${Math.round((e.value / totals.total) * 100)}%)`}
                >
                  {pieData.map((d) => (
                    /* Stroke matches the card behind it, so the gap between
                       slices reads as a seam rather than a white outline. */
                    <Cell key={d.name} fill={d.color} stroke="#0b0761" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#090654",
                    border: "1px solid #535291",
                    borderRadius: 12,
                    color: "#FFFFFF",
                  }}
                  itemStyle={{ color: "#FFFFFF" }}
                  labelStyle={{ color: "#C6C5DA" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Panel>

      {/* Filters */}
      <Panel className="rise-in flex flex-wrap items-end gap-3 p-4 md:p-4">
        <FieldFilter label="Section">
          <select
            value={fSection}
            onChange={(e) => {
              setFSection(e.target.value as any);
              setFSkill("");
            }}
            className={CONTROL_CLASS}
          >
            <option value="all">All</option>
            <option value="reading_writing">Reading & Writing</option>
            <option value="math">Math</option>
          </select>
        </FieldFilter>
        <FieldFilter label="Skill">
          <select
            value={fSkill}
            onChange={(e) => setFSkill(e.target.value)}
            className={CONTROL_CLASS}
          >
            <option value="">Any</option>
            {skillOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </FieldFilter>
        <FieldFilter label="Difficulty">
          <select
            value={fDifficulty}
            onChange={(e) => setFDifficulty(e.target.value as any)}
            className={CONTROL_CLASS}
          >
            <option value="">Any</option>
            {LETTER_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FieldFilter>
        {/* The date pickers need color-scheme:dark on top of the shared control
            class so the native calendar icon shows up on the navy field. */}
        <FieldFilter label="From">
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={CONTROL_CLASS + " [color-scheme:dark]"} />
        </FieldFilter>
        <FieldFilter label="To">
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={CONTROL_CLASS + " [color-scheme:dark]"} />
        </FieldFilter>
      </Panel>

      {/* Sessions list */}
      <div className="overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel rise-in">
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-brand-100">
            No completed tests match these filters yet.
          </div>
        ) : (
          <ul className="divide-y divide-brand-400/40 stagger-fast">
            {filteredSessions.map((s) => (
              <SessionItem
                key={s.id}
                session={s}
                attempts={attempts.filter((a) => a.session_id === s.id)}
                isOpen={openSession === s.id}
                onToggle={() => setOpenSession(openSession === s.id ? null : s.id)}
                fSection={fSection}
                fSkill={fSkill}
                fDifficulty={fDifficulty}
              />
            ))}
          </ul>
        )}
      </div>

      <div className="text-center">
        <Link
          to="/practice"
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 transition-colors hover:text-brand-400"
        >
          <span className="transition-transform duration-300 group-hover:-translate-x-0.5">←</span>
          Back to practice
        </Link>
      </div>
      <Outlet />
    </div>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="group rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel lift">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-100">{label}</span>
        {icon && (
          <span className="tile-invert grid h-8 w-8 place-items-center rounded-xl bg-brand-400 text-white">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 text-3xl font-black tabular-nums text-white">{value}</div>
      {hint && <div className="mt-1 text-xs text-brand-100">{hint}</div>}
    </div>
  );
}

/**
 * Animated 400-1600 counter. Reads 0 (not the 400 scale floor) when the student
 * has no completed mock exams, so an empty state is unambiguous.
 */
function ScoreCounter({
  label,
  value,
  hint,
  delta,
  emphasis = false,
}: {
  label: string;
  value: number;
  hint?: string;
  delta?: number | null;
  emphasis?: boolean;
}) {
  const empty = value === 0;
  const band = empty ? null : scoreBand(value);
  return (
    <div
      className={
        /* The emphasised counter uses the gradient surface plus the animated
           ring; the other two sit a step darker so "current score" still leads
           without leaving the ramp. */
        "group relative overflow-hidden rounded-2xl border p-5 shadow-panel rise-in lift " +
        (emphasis
          ? "ring-grad border-brand-300/50 bg-grad-brand"
          : "border-brand-400/40 bg-brand-600")
      }
    >
      {emphasis && (
        <div
          aria-hidden="true"
          className="drift pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-brand-300/30 blur-3xl"
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-brand-100">
            {label}
          </span>
          <span
            className={
              "tile-invert grid h-8 w-8 place-items-center rounded-xl " +
              (emphasis ? "bg-brand-400 text-white" : "bg-brand-800 text-brand-100")
            }
          >
            <Gauge className="h-[17px] w-[17px]" />
          </span>
        </div>

        <div className="mt-2.5 flex items-end gap-1.5">
          <span
            className={
              "pop-in font-black leading-none text-white " +
              (emphasis ? "text-5xl" : "text-4xl")
            }
          >
            <AnimatedNumber value={value} />
          </span>
          <span className="pb-1 text-sm font-medium text-brand-100">/ 1600</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {band && <Badge label={band.label} tone={band.tone as Tone} />}
          {delta != null && delta !== 0 && <Delta value={delta} suffix="vs previous" />}
        </div>

        {/* Progress along the 400-1600 range */}
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-brand-800">
          <div
            className="sweep-right h-full rounded-full bg-brand-200 transition-[width] duration-700"
            style={{ width: `${empty ? 0 : scoreProgress(value)}%` }}
          />
        </div>

        {hint && <div className="mt-2.5 text-xs text-brand-100">{hint}</div>}
      </div>
    </div>
  );
}

/**
 * Manual raw-score calculator: enter how many questions you got right in each
 * section and get an estimated scaled score. Independent of saved sessions, so
 * it works for paper practice tests taken outside the app.
 */
function ScoreCalculator() {
  const [rw, setRw] = useState("");
  const [math, setMath] = useState("");

  const rwNum = clampInt(rw, RW_QUESTION_COUNT);
  const mathNum = clampInt(math, MATH_QUESTION_COUNT);
  const touched = rw !== "" || math !== "";
  const est = estimateScore(rwNum, mathNum);
  const band = scoreBand(est.total);

  return (
    <div className="rounded-2xl border border-brand-400/30 bg-grad-surface p-5 shadow-panel rise-in md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          {/* This card has always been a dark gradient, so the heading and copy
              were slate-on-navy and effectively unreadable. */}
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-brand-400 text-white">
              <Calculator className="h-[17px] w-[17px]" />
            </span>
            Score calculator
          </h2>
          <p className="mt-1.5 text-xs text-brand-100">
            Enter your correct answers per section to estimate a scaled score.
          </p>
        </div>
        {touched && (
          <button
            onClick={() => {
              setRw("");
              setMath("");
            }}
            className="btn-ghost fade-in inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-brand-300/40 bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
        <RawInput
          label="Reading & Writing"
          max={RW_QUESTION_COUNT}
          value={rw}
          onChange={setRw}
          scaled={touched ? est.rw : null}
        />
        <RawInput
          label="Math"
          max={MATH_QUESTION_COUNT}
          value={math}
          onChange={setMath}
          scaled={touched ? est.math : null}
        />

        <div className="relative overflow-hidden rounded-xl bg-grad-brand px-6 py-4 text-center text-white shadow-brand">
          <div
            aria-hidden="true"
            className="drift pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-white/10 blur-2xl"
          />
          <div className="relative">
            {/* Both labels were white at reduced opacity; on this gradient the
                brand-100 step reads as secondary at full opacity instead. */}
            <div className="text-[10px] font-bold uppercase tracking-wider text-brand-100">
              Estimated total
            </div>
            {/* Tweens as the inputs change, so the total visibly reacts. */}
            <div className="mt-0.5 text-3xl font-black">
              <AnimatedNumber value={touched ? est.total : 0} duration={500} />
            </div>
            <div className="text-[10px] font-semibold text-brand-100">
              {touched ? band.label : "Enter your answers"}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-brand-100">
        Estimate only. The real Digital SAT is section-adaptive and College Board does not publish
        its conversion curves, so your official score may differ.
      </p>
    </div>
  );
}

function RawInput({
  label,
  max,
  value,
  onChange,
  scaled,
}: {
  label: string;
  max: number;
  value: string;
  onChange: (v: string) => void;
  scaled: number | null;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-100">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        {/* color-scheme:dark keeps the native number spinner light against the
            navy field; without it the arrows render as dark-on-dark. */}
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          aria-label={`${label} correct answers out of ${max}`}
          className="w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2.5 text-sm tabular-nums text-white transition-all duration-200 placeholder:text-brand-200 focus:border-brand-200 focus:shadow-brand focus:outline-none focus:ring-2 focus:ring-brand-200/25 [color-scheme:dark]"
        />
        <span className="shrink-0 text-xs text-brand-100">/ {max}</span>
      </div>
      {/* Raw-to-scaled readout, tweened so it tracks typing. */}
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <Target className="h-3.5 w-3.5 text-brand-200" />
        <span className="text-brand-100">Scaled:</span>
        <span className="font-bold text-white">
          {scaled == null ? "—" : <AnimatedNumber value={scaled} duration={400} />}
        </span>
      </div>
    </label>
  );
}

/** Parses user input to an int inside [0, max]; blank or invalid becomes 0. */
function clampInt(raw: string, max: number): number {
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(max, n));
}

function FieldFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-100">{label}</span>
      {children}
    </label>
  );
}

/** Shared control styling for the filter row's selects and date inputs. */
const CONTROL_CLASS =
  "rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white transition-all duration-200 hover:border-brand-300 focus:border-brand-200 focus:outline-none focus:ring-2 focus:ring-brand-200/25";

function SessionItem({
  session,
  attempts,
  isOpen,
  onToggle,
  fSection,
  fSkill,
  fDifficulty,
}: {
  session: SessionRow;
  attempts: AttemptRow[];
  isOpen: boolean;
  onToggle: () => void;
  fSection: Section | "all";
  fSkill: string;
  fDifficulty: Difficulty | "";
}) {
  const [details, setDetails] = useState<QuestionLite[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || details !== null) return;
    (async () => {
      setLoading(true);
      const ids = attempts.map((a) => a.question_id);
      if (ids.length === 0) {
        setDetails([]);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from("questions")
        .select("id,section,skill,difficulty,kind,question_text,choices,created_at")
        .in("id", ids);
      const { data: ans } = await supabase.rpc("get_answers_for_review" as any, {
        p_question_ids: ids,
      });
      const ansById = new Map(
        ((ans as any[]) ?? []).map((r) => [r.question_id, r]),
      );
      const merged = ((data ?? []) as any[]).map((q) => {
        const a = ansById.get(q.id) ?? {};
        return {
          ...q,
          correct_choice_id: a.correct_choice_id ?? null,
          correct_grid_answers: a.correct_grid_answers ?? null,
        };
      });
      setDetails(merged as unknown as QuestionLite[]);

      setLoading(false);
    })();
  }, [isOpen]);

  const correct = attempts.filter((a) => a.is_correct === true).length;
  const total = attempts.length;
  const pct = total ? Math.round((correct / total) * 100) : 0;
  const completed = session.completed_at ? new Date(session.completed_at) : null;

  const filteredAttempts = useMemo(() => {
    if (!details) return [];
    const byId = new Map(details.map((d) => [d.id, d]));
    return attempts.filter((a) => {
      const q = byId.get(a.question_id);
      if (!q) return false;
      if (fSection !== "all" && q.section !== fSection) return false;
      if (fSkill && q.skill !== fSkill) return false;
      if (fDifficulty && difficultyLabel(q.difficulty) !== fDifficulty) return false;
      return true;
    });
  }, [details, attempts, fSection, fSkill, fDifficulty]);

  return (
    <li>
      <div
        className={
          "flex w-full items-center gap-4 px-5 py-4 transition-colors duration-200 " +
          (isOpen ? "bg-brand-800" : "hover:bg-brand-800")
        }
      >
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold capitalize text-white">{session.type}</span>
            {session.type === "mock" && session.score != null && (
              <span className="rounded-full bg-brand-400 px-2 py-0.5 text-[10px] font-bold text-white">
                {session.score}
              </span>
            )}
            <span className="text-xs text-brand-100">
              {completed ? format(completed, "MMM d, yyyy · HH:mm") : "—"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-brand-100">
              {correct} / {total} correct · {pct}%
            </span>
            {/* Inline accuracy bar, so the list scans without opening rows. The
                fill is a flat light step, not the brand gradient — the row it
                sits on is already in the same family, so a gradient would
                disappear into it. */}
            <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-brand-900 sm:block">
              <span
                className="sweep-right block h-full rounded-full bg-brand-200"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        </button>
        <Link
          to="/analysis/session/$id"
          params={{ id: session.id }}
          className="btn-ghost hidden shrink-0 rounded-lg border border-brand-300/50 bg-brand-800 px-3 py-1.5 text-xs font-bold text-white sm:inline-flex"
        >
          Review in test view
        </Link>
        <button
          onClick={onToggle}
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-brand-100 hover:bg-brand-400 hover:text-white"
          aria-label={isOpen ? "Collapse details" : "Expand details"}
          aria-expanded={isOpen}
        >
          <ChevronRight
            className={
              "h-4 w-4 transition-transform duration-300 " + (isOpen ? "rotate-90" : "")
            }
          />
        </button>
      </div>
      {isOpen && (
        <div className="rise-in bg-brand-800/60 px-5 pb-5">
          {loading ? (
            /* Three placeholder rows the same height as the real detail cards,
               so expanding a session doesn't collapse and re-expand. */
            <div className="space-y-2 py-2">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-[86px] rounded-xl" />
              ))}
            </div>
          ) : (details && details.length === 0) ? (
            <div className="py-6 text-center text-sm text-brand-100">No question details available.</div>
          ) : filteredAttempts.length === 0 ? (
            <div className="py-6 text-center text-sm text-brand-100">No questions match the filters for this test.</div>
          ) : (
            <ul className="space-y-2 stagger-fast">
              {filteredAttempts.map((a, i) => {
                const q = details!.find((d) => d.id === a.question_id)!;
                const correctChoice = q.choices?.find((c) => c.id === q.correct_choice_id);
                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-brand-400/40 bg-brand-800 p-3 transition-shadow duration-200 hover:shadow-panel"
                  >
                    <div className="flex items-start gap-3">
                      {/* The check/cross shape already carries right-vs-wrong, so
                          the icons ride the brand ramp instead of green and red —
                          same treatment as the review overlay. */}
                      {a.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-white shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-brand-200 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-brand-100">Q{i + 1}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-400 text-white">
                            {SECTION_LABEL[q.section]}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-brand-700 text-brand-100">
                            {q.skill}
                          </span>
                          <span className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " + difficultyColor(q.difficulty)}>
                            {difficultyLabel(q.difficulty)}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm text-white line-clamp-2">{q.question_text}</div>
                        <div className="mt-1 text-xs text-brand-100">
                          {q.kind === "multiple_choice" ? (
                            <>
                              Your answer: <b>{a.selected_choice_id ?? "—"}</b> · Correct: <b>{correctChoice?.id ?? "—"}</b>
                            </>
                          ) : (
                            <>
                              Your answer: <b>{a.grid_answer ?? "—"}</b> · Correct: <b>{(q.correct_grid_answers ?? []).join(", ") || "—"}</b>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
