import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { BarChart3, ChevronRight, Loader2, CheckCircle2, XCircle } from "lucide-react";
import {
  RW_SKILLS,
  MATH_SKILLS,
  LETTER_DIFFICULTIES,
  SECTION_LABEL,
  difficultyColor,
  difficultyLabel,
  type Section,
  type Difficulty,
} from "@/lib/sat";
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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-black text-white">Analysis</h1>
        <p className="text-sm text-slate-600 mt-1">
          Review your progress and dig into every completed test.
        </p>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

      <div className="rounded-2xl border border-border bg-white p-6 soft-shadow">
        <h2 className="text-lg font-bold text-primary mb-2">Correct vs. wrong</h2>
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
                  outerRadius={90}
                  label={(e: any) => `${e.name}: ${e.value} (${Math.round((e.value / totals.total) * 100)}%)`}
                >
                  {pieData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
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
      <div className="rounded-2xl border border-border bg-white p-4 flex flex-wrap gap-3 items-end">
        <FieldFilter label="Section">
          <select
            value={fSection}
            onChange={(e) => {
              setFSection(e.target.value as any);
              setFSkill("");
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm"
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
            className="rounded-lg border border-border px-3 py-2 text-sm"
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
            className="rounded-lg border border-border px-3 py-2 text-sm"
          >
            <option value="">Any</option>
            {LETTER_DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </FieldFilter>
        <FieldFilter label="From">
          <input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
        </FieldFilter>
        <FieldFilter label="To">
          <input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
        </FieldFilter>
      </div>

      {/* Sessions list */}
      <div className="rounded-2xl border border-border bg-white overflow-hidden">
        {filteredSessions.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No completed tests match these filters yet.
          </div>
        ) : (
          <ul className="divide-y divide-border">
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
        <Link to="/practice" className="text-sm font-semibold text-primary hover:underline">
          ← Back to practice
        </Link>
      </div>
      <Outlet />
    </div>
  );
}

function StatCard({ label, value, hint, icon }: { label: string; value: React.ReactNode; hint?: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-white p-5 soft-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
        {icon && <span className="text-primary">{icon}</span>}
      </div>
      <div className="mt-2 text-3xl font-black text-primary tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

function FieldFilter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
      {children}
    </label>
  );
}

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
      <div className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50">
        <button onClick={onToggle} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800 capitalize">{session.type}</span>
            <span className="text-xs text-slate-500">
              {completed ? format(completed, "MMM d, yyyy · HH:mm") : "—"}
            </span>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            {correct} / {total} correct · {pct}%
            {session.score != null ? ` · score ${session.score}` : ""}
          </div>
        </button>
        <Link
          to="/analysis/session/$id"
          params={{ id: session.id }}
          className="rounded-lg border border-primary text-primary px-3 py-1.5 text-xs font-bold hover:bg-primary/5"
        >
          Review in test view
        </Link>
        <button onClick={onToggle}>
          <ChevronRight className={"h-4 w-4 text-slate-400 transition " + (isOpen ? "rotate-90" : "")} />
        </button>
      </div>
      {isOpen && (
        <div className="px-5 pb-5 bg-slate-50/60">
          {loading ? (
            <div className="py-6 text-center"><Loader2 className="h-5 w-5 animate-spin text-primary inline" /></div>
          ) : (details && details.length === 0) ? (
            <div className="py-6 text-center text-sm text-slate-500">No question details available.</div>
          ) : filteredAttempts.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">No questions match the filters for this test.</div>
          ) : (
            <ul className="space-y-2">
              {filteredAttempts.map((a, i) => {
                const q = details!.find((d) => d.id === a.question_id)!;
                const correctChoice = q.choices?.find((c) => c.id === q.correct_choice_id);
                return (
                  <li key={a.id} className="rounded-lg border border-border bg-white p-3">
                    <div className="flex items-start gap-3">
                      {a.is_correct ? (
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-slate-500">Q{i + 1}</span>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary">
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
