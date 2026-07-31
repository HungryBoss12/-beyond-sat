import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import {
  BarChart3,
  ChevronRight,
  Loader2,
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
import { PageHead } from "@/components/ui/panel";
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

  const pieData = [
    { name: "Correct", value: totals.correct, color: "#10b981" },
    { name: "Wrong", value: totals.wrong, color: "#ef4444" },
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

  if (loading) {
    return (
      <div className="grid place-items-center h-[50vh]">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
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

      <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-panel rise-in">
        <h2 className="mb-2 text-lg font-black tracking-tight text-slate-900">Correct vs. wrong</h2>
        {totals.total === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No answers yet — complete a practice test to see your breakdown.
          </div>
        ) : (
          <div className="h-64">
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
                  label={(e: any) => `${e.name}: ${e.value} (${Math.round((e.value / totals.total) * 100)}%)`}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} stroke="#fff" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-panel rise-in">
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
        <FieldFilter label="From">
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className={CONTROL_CLASS} />
        </FieldFilter>
        <FieldFilter label="To">
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className={CONTROL_CLASS} />
        </FieldFilter>
      </div>

      {/* Sessions list */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-panel rise-in">
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No completed tests match these filters yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 stagger-fast">
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
          className="group inline-flex items-center gap-1.5 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-800"
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
    <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-panel lift">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">{label}</span>
        {icon && (
          <span className="tile-invert grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
            {icon}
          </span>
        )}
      </div>
      <div className="mt-2.5 text-3xl font-black tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
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
        "group relative overflow-hidden rounded-2xl border bg-white p-5 shadow-panel rise-in lift " +
        (emphasis ? "ring-grad border-blue-600/25" : "border-slate-200/80")
      }
    >
      {emphasis && (
        <div
          aria-hidden="true"
          className="drift pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full bg-blue-100/60 blur-3xl"
        />
      )}
      <div className="relative">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </span>
          <span
            className={
              "tile-invert grid h-8 w-8 place-items-center rounded-xl " +
              (emphasis ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-400")
            }
          >
            <Gauge className="h-[17px] w-[17px]" />
          </span>
        </div>

        <div className="mt-2.5 flex items-end gap-1.5">
          <span
            className={
              "pop-in font-black leading-none " +
              (emphasis ? "text-5xl text-blue-600" : "text-4xl text-slate-900")
            }
          >
            <AnimatedNumber value={value} />
          </span>
          <span className="pb-1 text-sm font-medium text-slate-400">/ 1600</span>
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-2">
          {band && <Badge label={band.label} tone={band.tone as Tone} />}
          {delta != null && delta !== 0 && <Delta value={delta} suffix="vs previous" />}
        </div>

        {/* Progress along the 400-1600 range */}
        <div className="mt-3.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="sweep-right h-full rounded-full bg-grad-brand transition-[width] duration-700"
            style={{ width: `${empty ? 0 : scoreProgress(value)}%` }}
          />
        </div>

        {hint && <div className="mt-2.5 text-xs text-slate-500">{hint}</div>}
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
    <div className="rounded-2xl border border-slate-200/80 bg-grad-surface p-5 shadow-panel rise-in md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-black tracking-tight text-slate-900">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-blue-50 text-blue-600">
              <Calculator className="h-[17px] w-[17px]" />
            </span>
            Score calculator
          </h2>
          <p className="mt-1.5 text-xs text-slate-500">
            Enter your correct answers per section to estimate a scaled score.
          </p>
        </div>
        {touched && (
          <button
            onClick={() => {
              setRw("");
              setMath("");
            }}
            className="btn-ghost fade-in inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600"
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
            <div className="text-[10px] font-bold uppercase tracking-wider text-white/70">
              Estimated total
            </div>
            {/* Tweens as the inputs change, so the total visibly reacts. */}
            <div className="mt-0.5 text-3xl font-black">
              <AnimatedNumber value={touched ? est.total : 0} duration={500} />
            </div>
            <div className="text-[10px] font-semibold text-white/80">
              {touched ? band.label : "Enter your answers"}
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={0}
          max={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          aria-label={`${label} correct answers out of ${max}`}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm tabular-nums transition-all duration-200 focus:border-blue-600 focus:shadow-brand focus:outline-none focus:ring-2 focus:ring-blue-600/15"
        />
        <span className="shrink-0 text-xs text-slate-400">/ {max}</span>
      </div>
      {/* Raw-to-scaled readout, tweened so it tracks typing. */}
      <div className="mt-2 flex items-center gap-1.5 text-xs">
        <Target className="h-3.5 w-3.5 text-blue-600" />
        <span className="text-slate-500">Scaled:</span>
        <span className="font-bold text-slate-900">
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
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

/** Shared control styling for the filter row's selects and date inputs. */
const CONTROL_CLASS =
  "rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition-all duration-200 hover:border-slate-300 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/15";

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
          (isOpen ? "bg-blue-50/40" : "hover:bg-slate-50")
        }
      >
        <button onClick={onToggle} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold capitalize text-slate-800">{session.type}</span>
            {session.type === "mock" && session.score != null && (
              <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                {session.score}
              </span>
            )}
            <span className="text-xs text-slate-500">
              {completed ? format(completed, "MMM d, yyyy · HH:mm") : "—"}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="text-xs text-slate-500">
              {correct} / {total} correct · {pct}%
            </span>
            {/* Inline accuracy bar, so the list scans without opening rows. */}
            <span className="hidden h-1 w-24 overflow-hidden rounded-full bg-slate-100 sm:block">
              <span
                className="sweep-right block h-full rounded-full bg-grad-brand"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        </button>
        <Link
          to="/analysis/session/$id"
          params={{ id: session.id }}
          className="btn-ghost hidden shrink-0 rounded-lg border border-blue-600/40 bg-white px-3 py-1.5 text-xs font-bold text-blue-600 sm:inline-flex"
        >
          Review in test view
        </Link>
        <button
          onClick={onToggle}
          className="tap grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-blue-600"
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
        <div className="rise-in bg-slate-50/60 px-5 pb-5">
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-blue-600 inline" /></div>
          ) : (details && details.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-500">No question details available.</div>
          ) : filteredAttempts.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No questions match the filters for this test.</div>
          ) : (
            <ul className="space-y-2 stagger-fast">
              {filteredAttempts.map((a, i) => {
                const q = details!.find((d) => d.id === a.question_id)!;
                const correctChoice = q.choices?.find((c) => c.id === q.correct_choice_id);
                return (
                  <li
                    key={a.id}
                    className="rounded-xl border border-slate-200/80 bg-white p-3 transition-shadow duration-200 hover:shadow-panel"
                  >
                    <div className="flex items-start gap-3">
                      {a.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">Q{i + 1}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                            {SECTION_LABEL[q.section]}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                            {q.skill}
                          </span>
                          <span className={"text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded " + difficultyColor(q.difficulty)}>
                            {difficultyLabel(q.difficulty)}
                          </span>
                        </div>
                        <div className="mt-1.5 text-sm text-slate-800 line-clamp-2">{q.question_text}</div>
                        <div className="mt-1 text-xs text-slate-500">
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
