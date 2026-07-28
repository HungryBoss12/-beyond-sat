import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  CalendarDays,
  ArrowRight,
  Trophy,
  Sparkles,
  Shield,
} from "lucide-react";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { RW_SKILLS, MATH_SKILLS } from "@/lib/sat";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — BeyondSAT" },
      { name: "description", content: "Your SAT prep dashboard: streak, scores, and recommendations." },
    ],
  }),
});

type StudentProfile = {
  target_score: number | null;
  exam_date: string | null;
  level: string | null;
  fears: string[] | null;
  current_streak: number;
  longest_streak: number;
  last_daily_completed_date: string | null;
};

type Session = {
  id: string;
  type: "practice" | "daily" | "mock";
  score: number | null;
  rw_score: number | null;
  math_score: number | null;
  completed_at: string | null;
  started_at: string;
};

type AttemptRow = {
  is_correct: boolean | null;
  questions: { section: "reading_writing" | "math"; skill: string } | null;
};

function Dashboard() {
  const [name, setName] = useState<string>("");
  const [sp, setSp] = useState<StudentProfile | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [attempts, setAttempts] = useState<AttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [{ data: prof }, { data: spData }, { data: sess }, { data: att }, { data: role }] = await Promise.all([
        supabase.from("profiles").select("full_name,first_name").eq("id", uid).maybeSingle(),
        supabase
          .from("student_profiles")
          .select("target_score,exam_date,level,fears,current_streak,longest_streak,last_daily_completed_date")
          .eq("user_id", uid)
          .maybeSingle(),
        supabase
          .from("test_sessions")
          .select("id,type,score,rw_score,math_score,completed_at,started_at")
          .eq("user_id", uid)
          .not("completed_at", "is", null)
          .order("completed_at", { ascending: false })
          .limit(20),
        supabase
          .from("attempts")
          .select("is_correct, questions(section,skill)")
          .eq("user_id", uid)
          .limit(1000),
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
      ]);
      setName(prof?.full_name || prof?.first_name || "Student");
      setSp((spData as StudentProfile) ?? null);
      setSessions((sess as Session[]) ?? []);
      setAttempts((att as unknown as AttemptRow[]) ?? []);
      setIsAdmin(!!role);
      setLoading(false);
    })();
  }, []);

  const mocks = sessions.filter((s) => s.type === "mock");
  const dailyDoneToday = sp?.last_daily_completed_date === today;

  const avg = useMemo(() => {
    const scored = mocks.filter((m) => m.score != null) as (Session & { score: number })[];
    if (scored.length === 0) return null;
    const total = scored.reduce((a, b) => a + (b.score ?? 0), 0) / scored.length;
    const rw =
      scored.reduce((a, b) => a + (b.rw_score ?? 0), 0) /
      Math.max(1, scored.filter((s) => s.rw_score != null).length);
    const math =
      scored.reduce((a, b) => a + (b.math_score ?? 0), 0) /
      Math.max(1, scored.filter((s) => s.math_score != null).length);
    const prev = scored.slice(1);
    const prevAvg =
      prev.length > 0 ? prev.reduce((a, b) => a + (b.score ?? 0), 0) / prev.length : null;
    const delta = prevAvg == null ? 0 : total - prevAvg;
    return { total: Math.round(total), rw: Math.round(rw), math: Math.round(math), delta };
  }, [mocks]);

  const radarData = useMemo(() => {
    const skills = [...RW_SKILLS, ...MATH_SKILLS];
    const counts: Record<string, { c: number; t: number }> = {};
    skills.forEach((s) => (counts[s] = { c: 0, t: 0 }));
    for (const a of attempts) {
      const sk = a.questions?.skill;
      if (!sk || !(sk in counts)) continue;
      counts[sk].t += 1;
      if (a.is_correct) counts[sk].c += 1;
    }
    return skills.map((s) => ({
      skill: shortSkill(s),
      value: counts[s].t === 0 ? 0 : Math.round((counts[s].c / counts[s].t) * 100),
    }));
  }, [attempts]);

  const weakest = useMemo(() => {
    const withData = radarData.filter((r) => r.value > 0);
    if (withData.length === 0) return null;
    return withData.sort((a, b) => a.value - b.value)[0];
  }, [radarData]);

  const daysToExam = sp?.exam_date
    ? Math.max(0, Math.ceil((new Date(sp.exam_date).getTime() - Date.now()) / 86400000))
    : null;

  if (loading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 animate-pulse">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-48 rounded-2xl bg-white border border-border" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight">
            Welcome back, {name.split(" ")[0]}.
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {sp?.target_score
              ? `Target ${sp.target_score}${daysToExam != null ? ` · ${daysToExam} days to exam` : ""}.`
              : "Let's build your prep plan."}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-white hover:bg-[#002a56] transition soft-shadow self-start md:self-auto"
          >
            <Shield className="h-4 w-4" /> Open Admin Panel <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily test CTA */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-primary to-[#00234a] text-white border-transparent">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider">
                <Sparkles className="h-3 w-3" /> Today's daily test
              </div>
              <h2 className="mt-3 text-2xl font-black text-white">Keep your streak alive</h2>
              <p className="mt-1 text-white/70 text-sm max-w-md">
                {dailyDoneToday
                  ? "Done for today — nice work. Come back tomorrow."
                  : "A quick mixed set. 10–15 minutes. Feeds your streak."}
              </p>
            </div>
            <Flame className="h-10 w-10 text-orange-300 fill-orange-300 shrink-0" />
          </div>
          <Link
            to={dailyDoneToday ? "/practice" : "/practice/daily"}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-primary hover:bg-white/90 transition"
          >
            {dailyDoneToday ? "Practice more" : "Start today's test"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        {/* Streak */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Win streak</div>
            <Flame className="h-5 w-5 text-orange-500 fill-orange-500" />
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-5xl font-black text-slate-900 tabular-nums">
              {sp?.current_streak ?? 0}
            </div>
            <div className="text-sm text-slate-500">days</div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> Longest: {sp?.longest_streak ?? 0} days
          </div>
          <p className="mt-3 text-xs text-slate-500">Complete today's daily test to keep it going.</p>
        </Card>

        {/* Average score */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Average score</div>
            <Target className="h-5 w-5 text-primary" />
          </div>
          {avg ? (
            <>
              <div className="mt-3 flex items-baseline gap-3">
                <div className="text-5xl font-black text-primary tabular-nums">{avg.total}</div>
                <TrendBadge delta={avg.delta} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                <MiniStat label="R&W" value={avg.rw} />
                <MiniStat label="Math" value={avg.math} />
              </div>
            </>
          ) : (
            <EmptyMini text="No mock exams yet." />
          )}
        </Card>

        {/* Recommendations */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Focus next</div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="mt-3 space-y-2.5">
            {buildRecs(sp, weakest).map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:border-primary/40 transition"
              >
                <div className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-primary text-sm font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{r.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{r.desc}</div>
                </div>
                <Link
                  to={r.to}
                  className="text-xs font-bold text-primary hover:underline shrink-0 mt-1"
                >
                  Go →
                </Link>
              </div>
            ))}
          </div>
        </Card>

        {/* Radar */}
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Skill radar</div>
            <span className="text-xs text-slate-500">Accuracy %</span>
          </div>
          <div className="mt-2 h-72">
            {attempts.length === 0 ? (
              <EmptyMini text="Answer questions to fill your radar." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData} outerRadius="75%">
                  <PolarGrid stroke="#e2e8f0" />
                  <PolarAngleAxis
                    dataKey="skill"
                    tick={{ fill: "#475569", fontSize: 11, fontWeight: 600 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar
                    name="Accuracy"
                    dataKey="value"
                    stroke="#00356B"
                    fill="#00356B"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Mock history */}
        <Card>
          <div className="flex items-center justify-between">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Mock history</div>
            <CalendarDays className="h-5 w-5 text-slate-400" />
          </div>
          {mocks.length === 0 ? (
            <div className="mt-6">
              <EmptyMini text="No mock exams taken yet." />
              <Link
                to="/practice"
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
              >
                Take one <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-border">
              {mocks.slice(0, 6).map((m) => (
                <li key={m.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {m.completed_at ? format(new Date(m.completed_at), "MMM d, yyyy") : "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      R&W {m.rw_score ?? "—"} · Math {m.math_score ?? "—"}
                    </div>
                  </div>
                  <div className="text-xl font-black text-primary tabular-nums">{m.score ?? "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl border border-border bg-white p-5 md:p-6 soft-shadow " + className}>
      {children}
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-lg font-black text-slate-800 tabular-nums">{value}</div>
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-slate-500">{text}</p>;
}

function TrendBadge({ delta }: { delta: number }) {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
        <Minus className="h-3 w-3" /> 0
      </span>
    );
  const up = delta > 0;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold " +
        (up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")
      }
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? "+" : ""}
      {Math.round(delta)}
    </span>
  );
}

function shortSkill(s: string) {
  return s
    .replace("Standard English Conventions", "SE Conv.")
    .replace("Problem-Solving and Data Analysis", "PS & Data")
    .replace("Geometry and Trigonometry", "Geo & Trig")
    .replace("Information and Ideas", "Info & Ideas")
    .replace("Craft and Structure", "Craft & Str.")
    .replace("Expression of Ideas", "Expression")
    .replace("Advanced Math", "Adv. Math");
}

function buildRecs(
  sp: StudentProfile | null,
  weakest: { skill: string; value: number } | null,
): { title: string; desc: string; to: "/practice" }[] {
  const recs: { title: string; desc: string; to: "/practice" }[] = [];
  if (weakest) {
    recs.push({
      title: `Drill ${weakest.skill}`,
      desc: `Your weakest area at ${weakest.value}% accuracy.`,
      to: "/practice",
    });
  }
  if (sp?.fears?.includes("Running out of time")) {
    recs.push({
      title: "Timed mixed set",
      desc: "Build pace with a strict-timer practice set.",
      to: "/practice",
    });
  }
  if (sp?.level === "Just starting" || sp?.level === "Beginner") {
    recs.push({
      title: "Foundations: Algebra",
      desc: "Start with easy-medium Algebra to lock in fundamentals.",
      to: "/practice",
    });
  } else {
    recs.push({
      title: "Full mock exam",
      desc: "Benchmark where you are with a two-module mock.",
      to: "/practice",
    });
  }
  if (recs.length < 3) {
    recs.push({
      title: "Today's daily test",
      desc: "Short, mixed, and keeps your streak alive.",
      to: "/practice",
    });
  }
  return recs.slice(0, 3);
}
