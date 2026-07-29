import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  ArrowRight,
  Trophy,
  Sparkles,
  Shield,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  Radar,
  RadarChart,
  PolarGrid,
  PolarRadiusAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { RW_SKILLS, MATH_SKILLS, scoreBand } from "@/lib/sat";
import { CountUp } from "@/components/CountUp";
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

  /** Most recent scored mock — the headline "Your Progress" number. */
  const latest = useMemo(() => {
    const scored = mocks.filter((m) => m.score != null) as (Session & { score: number })[];
    if (scored.length === 0) return null;
    const [current, previous] = scored;
    return {
      score: current.score,
      rw: current.rw_score,
      math: current.math_score,
      delta: previous?.score != null ? current.score - previous.score : null,
      at: current.completed_at,
    };
  }, [mocks]);

  const avg = useMemo(() => {
    const scored = mocks.filter((m) => m.score != null) as (Session & { score: number })[];
    if (scored.length === 0) return null;
    const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const rwVals = scored.map((s) => s.rw_score).filter((v): v is number => v != null);
    const mathVals = scored.map((s) => s.math_score).filter((v): v is number => v != null);
    return {
      total: Math.round(mean(scored.map((s) => s.score))),
      rw: rwVals.length ? Math.round(mean(rwVals)) : 0,
      math: mathVals.length ? Math.round(mean(mathVals)) : 0,
      best: Math.max(...scored.map((s) => s.score)),
      count: scored.length,
    };
  }, [mocks]);

  /** Score trend, oldest -> newest, for the line chart. */
  const trend = useMemo(() => {
    const scored = (mocks.filter((m) => m.score != null) as (Session & { score: number })[])
      .slice()
      .reverse()
      .slice(-6);
    return scored.map((m) => ({
      label: m.completed_at ? format(new Date(m.completed_at), "MMM") : "—",
      score: m.score,
    }));
  }, [mocks]);

  const accuracy = useMemo(() => {
    const graded = attempts.filter((a) => a.is_correct != null);
    if (graded.length === 0) return null;
    const bySection = (section: "reading_writing" | "math") => {
      const rows = graded.filter((a) => a.questions?.section === section);
      if (rows.length === 0) return null;
      return Math.round((rows.filter((a) => a.is_correct).length / rows.length) * 100);
    };
    return {
      overall: Math.round((graded.filter((a) => a.is_correct).length / graded.length) * 100),
      rw: bySection("reading_writing"),
      math: bySection("math"),
      answered: graded.length,
    };
  }, [attempts]);

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

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 rise-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Welcome back, {name.split(" ")[0]}.
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {sp?.target_score
              ? `Target ${sp.target_score}${daysToExam != null ? ` · ${daysToExam} days to exam` : ""}.`
              : "Let's build your prep plan."}
          </p>
        </div>
        {isAdmin && (
          <Link
            to="/admin"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition soft-shadow self-start md:self-auto"
          >
            <Shield className="h-4 w-4" /> Open Admin Panel <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      {/* Hero: progress + accuracy, mirroring the product mockup */}
      <div className="grid gap-5 lg:grid-cols-5">
        <ProgressPanel latest={latest} trend={trend} target={sp?.target_score ?? null} />
        <AccuracyPanel accuracy={accuracy} />
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 stagger">
        <StatChip
          icon={ClipboardList}
          value={avg?.count ?? 0}
          label="Tests Taken"
        />
        <StatChip icon={TrendingUp} value={avg?.total ?? 0} label="Average Score" />
        <StatChip icon={Trophy} value={avg?.best ?? 0} label="Best Score" />
        <StatChip icon={Target} value={accuracy?.overall ?? 0} suffix="%" label="Accuracy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Daily test CTA */}
        <Card className="lg:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-transparent rise-in">
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
            <Flame className="h-10 w-10 shrink-0 text-orange-300 fill-orange-300" />
          </div>
          <Link
            to={dailyDoneToday ? "/practice" : "/practice/daily"}
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-bold text-blue-600 hover:bg-blue-50 transition"
          >
            {dailyDoneToday ? "Practice more" : "Start today's test"} <ArrowRight className="h-4 w-4" />
          </Link>
        </Card>

        {/* Streak */}
        <Card className="rise-in lift">
          <CardHead label="Win streak" icon={Flame} iconClass="text-orange-500 fill-orange-500" />
          <div className="mt-3 flex items-baseline gap-2">
            <div className="text-5xl font-black tabular-nums text-slate-900 pop-in">
              {sp?.current_streak ?? 0}
            </div>
            <div className="text-sm text-slate-500">days</div>
          </div>
          <div className="mt-4 flex items-center gap-1.5 text-xs text-slate-500">
            <Trophy className="h-3.5 w-3.5 text-amber-500" /> Longest: {sp?.longest_streak ?? 0} days
          </div>
          <p className="mt-3 text-xs text-slate-500">Complete today's daily test to keep it going.</p>
        </Card>

        {/* Recommendations */}
        <Card className="lg:col-span-2 rise-in">
          <CardHead label="Focus next" icon={Sparkles} />
          <div className="mt-3 space-y-2.5 stagger">
            {buildRecs(sp, weakest).map((r, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition hover:border-blue-600/40 hover:bg-blue-50/40"
              >
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-50 text-sm font-bold text-blue-600">
                  {i + 1}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{r.title}</div>
                  <div className="mt-0.5 text-xs text-slate-500">{r.desc}</div>
                </div>
                <Link
                  to={r.to}
                  className="mt-1 shrink-0 text-xs font-bold text-blue-600 hover:underline"
                >
                  Go →
                </Link>
              </div>
            ))}
          </div>
        </Card>

        {/* Skill radar */}
        <Card className="lg:col-span-2 rise-in">
          <CardHead label="Skill radar" icon={BarChart3} />
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
                    stroke="#1313cf"
                    fill="#1313cf"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>

        {/* Mock history */}
        <Card className="rise-in">
          <CardHead label="Mock history" icon={ClipboardList} iconClass="text-slate-400" />
          {mocks.length === 0 ? (
            <div className="mt-6">
              <EmptyMini text="No mock exams taken yet." />
              <Link
                to="/practice"
                className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline"
              >
                Take one <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <ul className="mt-3 divide-y divide-slate-200">
              {mocks.slice(0, 6).map((m) => (
                <li key={m.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">
                      {m.completed_at ? format(new Date(m.completed_at), "MMM d, yyyy") : "—"}
                    </div>
                    <div className="text-xs text-slate-500">
                      R&W {m.rw_score ?? "—"} · Math {m.math_score ?? "—"}
                    </div>
                  </div>
                  <div className="text-xl font-black tabular-nums text-blue-600">{m.score ?? "—"}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

/** Headline score + six-mock trend line. Mirrors "Your Progress" in the mockup. */
function ProgressPanel({
  latest,
  trend,
  target,
}: {
  latest: { score: number; rw: number | null; math: number | null; delta: number | null; at: string | null } | null;
  trend: { label: string; score: number }[];
  target: number | null;
}) {
  const band = latest ? scoreBand(latest.score) : null;
  return (
    <Card className="lg:col-span-3 rise-in">
      <div className="flex items-start justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Your Progress</div>
        {target != null && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
            Target {target}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="text-4xl md:text-5xl font-black tracking-tight tabular-nums text-slate-900 pop-in">
          <CountUp end={latest?.score ?? 0} />
        </span>
        <span className="text-sm font-medium text-slate-400">/1600</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {band && <BandBadge band={band} />}
        {latest?.delta != null && <TrendBadge delta={latest.delta} suffix="vs last test" />}
        {!latest && (
          <span className="text-xs text-slate-500">
            No mock exams yet — your score appears here after your first one.
          </span>
        )}
      </div>

      <div className="mt-4 h-[168px]">
        {trend.length < 2 ? (
          <div className="grid h-full place-content-center rounded-xl border border-dashed border-slate-200 text-center">
            <p className="text-xs text-slate-500">
              {trend.length === 0
                ? "Take a mock exam to start your trend line."
                : "One more mock and your trend line appears."}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 28, right: 20, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#F1F5F9" vertical={false} />
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10 }}
              />
              <YAxis
                domain={[400, 1600]}
                ticks={[400, 800, 1200, 1600]}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#94A3B8", fontSize: 10 }}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#1313cf"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: "#1313cf", stroke: "#fff", strokeWidth: 1.5 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}

/** Radial accuracy gauge + per-section split. Mirrors "Overall Accuracy". */
function AccuracyPanel({
  accuracy,
}: {
  accuracy: { overall: number; rw: number | null; math: number | null; answered: number } | null;
}) {
  const pct = accuracy?.overall ?? 0;
  const band =
    pct >= 90 ? "Excellent" : pct >= 75 ? "Strong" : pct >= 60 ? "Fair" : pct > 0 ? "Building" : "No data";
  return (
    <Card className="lg:col-span-2 rise-in">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Overall Accuracy</div>

      <div className="relative mx-auto mt-3 h-[150px] w-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={[{ name: "accuracy", value: pct, fill: "#1313cf" }]}
            innerRadius="72%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar dataKey="value" cornerRadius={12} background={{ fill: "#f0f0fe" }} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <div className="text-3xl font-black leading-none tabular-nums text-slate-900">
            <CountUp end={pct} suffix="%" />
          </div>
          <div className="mt-1 text-[10px] font-semibold text-blue-600">{band}</div>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <AccuracyRow label="Reading & Writing" value={accuracy?.rw ?? null} dotClass="bg-blue-600" />
        <AccuracyRow label="Math" value={accuracy?.math ?? null} dotClass="bg-blue-400" />
      </div>

      <p className="mt-3 text-[11px] text-slate-400">
        {accuracy ? `Across ${accuracy.answered.toLocaleString()} graded answers.` : "Answer questions to see this."}
      </p>
    </Card>
  );
}

function AccuracyRow({
  label,
  value,
  dotClass,
}: {
  label: string;
  value: number | null;
  dotClass: string;
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className={"h-2 w-2 shrink-0 rounded-full " + dotClass} />
      <span className="text-slate-600">{label}</span>
      <span className="ml-auto font-bold tabular-nums text-slate-900">
        {value == null ? "—" : `${value}%`}
      </span>
    </div>
  );
}

function StatChip({
  icon: Icon,
  value,
  label,
  suffix = "",
}: {
  icon: typeof Target;
  value: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 soft-shadow lift">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-600">
        <Icon className="h-4 w-4" strokeWidth={2} />
      </span>
      <span className="min-w-0">
        <span className="block text-lg font-black leading-tight tabular-nums text-slate-900">
          <CountUp end={value} suffix={suffix} />
        </span>
        <span className="block truncate text-[11px] text-slate-500">{label}</span>
      </span>
    </div>
  );
}

function BandBadge({ band }: { band: { label: string; tone: string } }) {
  const tones: Record<string, string> = {
    excellent: "bg-emerald-50 text-emerald-700",
    good: "bg-blue-50 text-blue-700",
    fair: "bg-amber-50 text-amber-700",
    low: "bg-slate-100 text-slate-600",
  };
  const dots: Record<string, string> = {
    excellent: "bg-emerald-500",
    good: "bg-blue-600",
    fair: "bg-amber-500",
    low: "bg-slate-400",
  };
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold " +
        (tones[band.tone] ?? tones.low)
      }
    >
      <span className={"h-1.5 w-1.5 rounded-full " + (dots[band.tone] ?? dots.low)} />
      {band.label}
    </span>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 animate-pulse rounded-lg bg-slate-100" />
      <div className="grid gap-5 lg:grid-cols-5">
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-3" />
        <div className="h-80 animate-pulse rounded-2xl border border-slate-200 bg-white lg:col-span-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-2xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={"rounded-2xl border border-slate-200 bg-white p-5 md:p-6 soft-shadow " + className}>
      {children}
    </div>
  );
}

function CardHead({
  label,
  icon: Icon,
  iconClass = "text-blue-600",
}: {
  label: string;
  icon: typeof Target;
  iconClass?: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <Icon className={"h-5 w-5 " + iconClass} />
    </div>
  );
}

function EmptyMini({ text }: { text: string }) {
  return <p className="mt-3 text-sm text-slate-500">{text}</p>;
}

function TrendBadge({ delta, suffix = "" }: { delta: number; suffix?: string }) {
  if (delta === 0)
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">
        <Minus className="h-3 w-3" /> 0 {suffix}
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
      {Math.round(delta)} {suffix}
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

