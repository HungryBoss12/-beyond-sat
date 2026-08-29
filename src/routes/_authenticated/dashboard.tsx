import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Flame,
  Target,
  ArrowRight,
  Trophy,
  Sparkles,
  Shield,
  ClipboardList,
  BarChart3,
  Gauge,
  CalendarClock,
} from "lucide-react";
import {
  Area,
  AreaChart,
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
  Tooltip,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { getStaffRole, EDITOR_HOME, type StaffRole } from "@/lib/admin";
import { RW_SKILLS, MATH_SKILLS, scoreBand } from "@/lib/sat";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import { FocusNextPanel } from "@/components/ai/FocusNextPanel";
import { AttendanceGrid } from "@/components/classes/AttendanceGrid";
import { Panel, PanelGlow, PanelHead, PageHead, EmptyState, Skeleton } from "@/components/ui/panel";
import { Badge, Delta, MeterRow, StatTile, type Tone } from "@/components/ui/metric";
import { listAttendance, type LessonAttendance } from "@/lib/classes";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    meta: [
      { title: "Dashboard — BeyondSAT" },
      {
        name: "description",
        content: "Your SAT prep dashboard: streak, scores, and recommendations.",
      },
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

function parseLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function todayYmd(): string {
  const now = new Date();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

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
  const [staffRole, setStaffRole] = useState<StaffRole | null>(null);
  const [attendance, setAttendance] = useState<LessonAttendance[]>([]);
  const [dailyExists, setDailyExists] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const uid = userData.user?.id;
      if (!uid) return;
      const [
        { data: prof },
        { data: spData },
        { data: sess },
        { data: att },
        role,
        lessonAtt,
        { data: dt },
      ] = await Promise.all([
        supabase.from("profiles").select("full_name,first_name").eq("id", uid).maybeSingle(),
        supabase
          .from("student_profiles")
          .select(
            "target_score,exam_date,level,fears,current_streak,longest_streak,last_daily_completed_date",
          )
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
        getStaffRole(uid),
        listAttendance(uid).catch(() => [] as LessonAttendance[]),
        supabase.from("daily_tests").select("id").eq("date", today).maybeSingle(),
      ]);
      setName(prof?.full_name || prof?.first_name || "Student");
      setSp((spData as StudentProfile) ?? null);
      setSessions((sess as Session[]) ?? []);
      setAttempts((att as unknown as AttemptRow[]) ?? []);
      setStaffRole(role);
      setAttendance(lessonAtt);
      setDailyExists(!!dt);
      setLoading(false);
    })();
  }, [today]);

  const mocks = useMemo(() => sessions.filter((s) => s.type === "mock"), [sessions]);
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

  /** Score trend, oldest -> newest, for the area chart. */
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

  /* `exam_date` is a DATE ("YYYY-MM-DD"); `new Date()` would read it as UTC
     midnight and come out a day short west of Greenwich. Compare local
     midnights instead so the countdown matches the date the user picked. */
  const daysToExam = sp?.exam_date
    ? Math.max(
        0,
        Math.round(
          (parseLocalDate(sp.exam_date).getTime() - parseLocalDate(todayYmd()).getTime()) /
            86400000,
        ),
      )
    : null;

  if (loading) return <DashboardSkeleton />;

  return (
    <div className="space-y-6">
      <PageHead
        title={`Welcome back, ${name.split(" ")[0]}.`}
        subtitle={
          sp?.target_score
            ? `Target ${sp.target_score}${daysToExam != null ? ` · ${daysToExam} days to exam` : ""}.`
            : "Let's build your prep plan."
        }
        action={
          staffRole ? (
            <Link
              to={staffRole === "admin" ? "/admin" : EDITOR_HOME}
              className="btn-brand group inline-flex items-center gap-2 rounded-xl bg-grad-brand px-4 py-2.5 text-sm font-bold text-white"
            >
              <Shield className="h-4 w-4" />
              {staffRole === "admin" ? "Admin Panel" : "Editor Panel"}
              <ArrowRight className="arrow-slide h-4 w-4" />
            </Link>
          ) : undefined
        }
      />

      {/* Hero row: headline score + accuracy gauge */}
      <div className="grid gap-5 lg:grid-cols-5">
        <ProgressPanel latest={latest} trend={trend} target={sp?.target_score ?? null} />
        <AccuracyPanel accuracy={accuracy} />
      </div>

      {/* Stat chips */}
      <div className="grid grid-cols-2 gap-4 stagger lg:grid-cols-4">
        <StatTile icon={ClipboardList} value={avg?.count ?? 0} label="Tests taken" accent="slate" />
        <StatTile icon={BarChart3} value={avg?.total ?? 0} label="Average score" accent="brand" />
        <StatTile icon={Trophy} value={avg?.best ?? 0} label="Best score" accent="amber" />
        <StatTile
          icon={Target}
          value={accuracy?.overall ?? 0}
          suffix="%"
          label="Accuracy"
          accent="emerald"
        />
      </div>

      <Panel>
        <AttendanceGrid rows={attendance} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <DailyPanel
          done={dailyDoneToday}
          streak={sp?.current_streak ?? 0}
          dailyExists={dailyExists}
        />
        <StreakPanel
          current={sp?.current_streak ?? 0}
          longest={sp?.longest_streak ?? 0}
          daysToExam={daysToExam}
        />
        {/* One panel, not two. The ranked steps are rule-based and always
            present; the suggestion above them and the ask box below are the
            model's read of the same data, so the student can push back on the
            advice instead of being handed it. */}
        <FocusNextPanel
          className="lg:col-span-3"
          recs={buildRecs(sp, weakest)}
          weakestSkill={weakest?.skill ?? null}
          accuracy={accuracy?.overall ?? null}
          latestScore={latest?.score ?? null}
          targetScore={sp?.target_score ?? null}
        />
        <RadarPanel data={radarData} hasData={attempts.length > 0} weakest={weakest} />
        <HistoryPanel mocks={mocks} />
      </div>
    </div>
  );
}

/**
 * Headline score + trend. The focal panel of the page, so it gets the ambient
 * glow and the gradient hairline; everything else stays flat by comparison.
 */
function ProgressPanel({
  latest,
  trend,
  target,
}: {
  latest: {
    score: number;
    rw: number | null;
    math: number | null;
    delta: number | null;
    at: string | null;
  } | null;
  trend: { label: string; score: number }[];
  target: number | null;
}) {
  const band = latest ? scoreBand(latest.score) : null;
  // Distance to target, shown only when the student has both a target and a
  // score to compare it against.
  const gap = latest && target != null ? target - latest.score : null;

  return (
    <Panel tone="soft" className="ring-grad overflow-hidden lg:col-span-3">
      <PanelGlow />
      <div className="relative">
        <PanelHead
          label="Your progress"
          icon={Gauge}
          hint={
            latest?.at
              ? `Latest mock · ${format(new Date(latest.at), "MMM d, yyyy")}`
              : "No mocks yet"
          }
          action={
            target != null ? (
              <span className="rounded-full bg-brand-800 px-2.5 py-1 text-[10px] font-bold text-white ring-1 ring-brand-400/40">
                Target {target}
              </span>
            ) : undefined
          }
        />

        <div className="mt-3 flex items-end gap-2">
          <span className="pop-in text-5xl font-black leading-none tracking-tight text-white md:text-6xl">
            <AnimatedNumber value={latest?.score ?? 0} />
          </span>
          <span className="pb-1 text-sm font-medium text-brand-100">/ 1600</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {band && <Badge label={band.label} tone={band.tone as Tone} />}
          {latest?.delta != null && <Delta value={latest.delta} suffix="vs last test" />}
          {gap != null && gap > 0 && (
            <span className="text-[11px] font-semibold text-brand-100">{gap} points to target</span>
          )}
          {gap != null && gap <= 0 && <Badge label="Target reached" tone="excellent" />}
          {!latest && (
            <span className="text-xs text-brand-100">
              Your score appears here after your first mock exam.
            </span>
          )}
        </div>

        <div className="mt-5 h-[188px]">
          {trend.length < 2 ? (
            <EmptyState
              className="h-full"
              icon={BarChart3}
              title={trend.length === 0 ? "No trend yet" : "One more mock to go"}
              body={
                trend.length === 0
                  ? "Take a full-length mock exam and your score history starts charting here."
                  : "Your trend line appears once you have two scored mocks to compare."
              }
              action={
                <Link
                  to="/practice"
                  className="btn-brand group inline-flex items-center gap-1.5 rounded-lg bg-grad-brand px-3.5 py-2 text-xs font-bold text-white"
                >
                  Take a mock <ArrowRight className="arrow-slide h-3.5 w-3.5" />
                </Link>
              }
            />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 12, right: 12, bottom: 0, left: -20 }}>
                {/* Soft brand wash under the line — lighter than the stroke so
                    the data reads first and the fill is only atmosphere. */}
                <defs>
                  <linearGradient id="dashTrend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#C6C5DA" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#C6C5DA" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#535291" strokeOpacity={0.55} vertical={false} />
                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#C6C5DA", fontSize: 11, fontWeight: 600 }}
                  dy={6}
                />
                <YAxis
                  domain={[400, 1600]}
                  ticks={[400, 800, 1200, 1600]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "#C6C5DA", fontSize: 10 }}
                />
                <Tooltip content={<ChartTip suffix=" / 1600" />} />
                <Area
                  type="monotone"
                  dataKey="score"
                  stroke="#C6C5DA"
                  strokeWidth={2.5}
                  fill="url(#dashTrend)"
                  dot={{ r: 3.5, fill: "#0B0761", stroke: "#C6C5DA", strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: "#535291", stroke: "#fff", strokeWidth: 2.5 }}
                  animationDuration={900}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Radial accuracy gauge + per-section split. */
function AccuracyPanel({
  accuracy,
}: {
  accuracy: { overall: number; rw: number | null; math: number | null; answered: number } | null;
}) {
  const pct = accuracy?.overall ?? 0;
  const tone: Tone = pct >= 90 ? "excellent" : pct >= 75 ? "good" : pct >= 60 ? "fair" : "low";
  const label =
    pct >= 90
      ? "Excellent"
      : pct >= 75
        ? "Strong"
        : pct >= 60
          ? "Fair"
          : pct > 0
            ? "Building"
            : "No data";

  return (
    <Panel className="lg:col-span-2">
      <PanelHead label="Overall accuracy" icon={Target} />

      <div className="relative mx-auto mt-4 h-[164px] w-[164px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            data={[{ name: "accuracy", value: pct }]}
            innerRadius="74%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
          >
            <defs>
              {/* Light end of the ramp, so the arc stays legible against the
                  #090654 track it sits on. */}
              <linearGradient id="dashGauge" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#C6C5DA" />
              </linearGradient>
            </defs>
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
            <RadialBar
              dataKey="value"
              cornerRadius={14}
              fill="url(#dashGauge)"
              background={{ fill: "#090654" }}
              animationDuration={1100}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
          <div className="text-3xl font-black leading-none text-white">
            <AnimatedNumber value={pct} suffix="%" />
          </div>
          <div className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
            {label}
          </div>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <MeterRow label="Reading & Writing" value={accuracy?.rw ?? null} barClass="bg-white" />
        <MeterRow label="Math" value={accuracy?.math ?? null} barClass="bg-brand-200" />
      </div>

      <p className="mt-4 text-[11px] text-brand-100">
        {accuracy
          ? `Across ${accuracy.answered.toLocaleString()} graded answers.`
          : "Answer some questions to see this."}
      </p>
      <span className="sr-only">
        Accuracy {pct} percent, rated {label}.
      </span>
    </Panel>
  );
}

/** Today's daily test — the one saturated surface on the page. */
function DailyPanel({
  done,
  streak,
  dailyExists,
}: {
  done: boolean;
  streak: number;
  dailyExists: boolean;
}) {
  const unavailable = !dailyExists;
  const title = unavailable
    ? "No daily test today"
    : done
      ? "Today's done."
      : "Keep your streak alive";
  const subtitle = unavailable
    ? "Check back when your teacher posts today's set — or jump into Practice."
    : done
      ? `You're ${streak} ${streak === 1 ? "day" : "days"} deep. Come back tomorrow to extend it.`
      : "A quick mixed set. 10–15 minutes, and it feeds your streak.";
  const ctaTo = unavailable || done ? "/practice" : "/practice/daily";
  const ctaLabel = unavailable ? "Browse practice" : done ? "Practice more" : "Start today's test";

  return (
    <Panel tone="brand" className="overflow-hidden lg:col-span-2">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="drift absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
        <div className="spin-slow absolute -bottom-24 -left-16 h-56 w-56 rounded-full border border-white/10" />
      </div>
      <div className="relative flex h-full flex-col">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-white/20">
              <Sparkles className="h-3 w-3" /> Today's daily test
            </span>
            <h2 className="mt-3 text-2xl font-black tracking-tight text-white">{title}</h2>
            <p className="mt-1.5 max-w-md text-sm text-brand-100">{subtitle}</p>
          </div>
          {/* Lit state reads through fill rather than a warm hue — the palette
              is white + #0B0761 only. */}
          <Flame
            className={
              "h-11 w-11 shrink-0 " +
              (done && dailyExists ? "fill-white text-white" : "text-brand-200")
            }
          />
        </div>
        <Link
          to={ctaTo}
          className="group mt-6 inline-flex w-fit items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-brand-700 tap shadow-lg shadow-brand-900/30 hover:bg-brand-50"
        >
          {ctaLabel}
          <ArrowRight className="arrow-slide h-4 w-4" />
        </Link>
      </div>
    </Panel>
  );
}

/** Streak counter with the exam countdown tucked underneath. */
function StreakPanel({
  current,
  longest,
  daysToExam,
}: {
  current: number;
  longest: number;
  daysToExam: number | null;
}) {
  return (
    <Panel interactive>
      <PanelHead label="Win streak" icon={Flame} tone="warm" />
      <div className="mt-3 flex items-baseline gap-2">
        <span className="pop-in text-5xl font-black leading-none text-white">
          <AnimatedNumber value={current} />
        </span>
        <span className="text-sm text-brand-100">{current === 1 ? "day" : "days"}</span>
      </div>

      {/* Longest streak as the bar's ceiling, so the fill reads as
          "how close am I to my own record". */}
      <div className="mt-4">
        <MeterRow
          label="Personal best"
          value={current}
          max={Math.max(longest, current, 1)}
          barClass="bg-gradient-to-r from-brand-200 to-white"
          display={`${longest} ${longest === 1 ? "day" : "days"}`}
        />
      </div>

      {/* Exam countdown sits in the deep shade so it reads as a nested box
          inside the brand panel rather than a light cut-out. */}
      <div className="mt-4 flex items-center gap-2 rounded-xl bg-brand-800 px-3 py-2.5 text-xs ring-1 ring-brand-400/40">
        <CalendarClock className="h-4 w-4 shrink-0 text-brand-200" />
        <span className="text-brand-100">
          {daysToExam != null ? (
            <>
              <b className="text-white">{daysToExam}</b> days until your exam
            </>
          ) : (
            "Set an exam date in your profile"
          )}
        </span>
      </div>
    </Panel>
  );
}

/** Per-skill accuracy radar. */
function RadarPanel({
  data,
  hasData,
  weakest,
}: {
  data: { skill: string; value: number }[];
  hasData: boolean;
  weakest: { skill: string; value: number } | null;
}) {
  return (
    <Panel className="lg:col-span-2">
      <PanelHead
        label="Skill radar"
        icon={BarChart3}
        hint={weakest ? `Weakest: ${weakest.skill} at ${weakest.value}%` : undefined}
      />
      <div className="mt-2 h-72">
        {!hasData ? (
          <EmptyState
            className="h-full"
            icon={Target}
            title="Radar is empty"
            body="Answer questions across the eight SAT skill areas and your strengths map out here."
            action={
              <Link
                to="/practice"
                className="btn-ghost inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-400 px-3.5 py-2 text-xs font-bold text-white"
              >
                Start practising
              </Link>
            }
          />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="74%">
              <defs>
                <linearGradient id="dashRadar" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#C6C5DA" stopOpacity={0.16} />
                </linearGradient>
              </defs>
              <PolarGrid stroke="#535291" />
              <PolarAngleAxis
                dataKey="skill"
                tick={{ fill: "#C6C5DA", fontSize: 10.5, fontWeight: 600 }}
              />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Tooltip content={<ChartTip suffix="% accuracy" />} />
              <Radar
                name="Accuracy"
                dataKey="value"
                stroke="#FFFFFF"
                fill="url(#dashRadar)"
                strokeWidth={2}
                animationDuration={900}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Panel>
  );
}

/** Recent mock exams, newest first. */
function HistoryPanel({ mocks }: { mocks: Session[] }) {
  return (
    <Panel>
      <PanelHead label="Mock history" icon={ClipboardList} tone="muted" />
      {mocks.length === 0 ? (
        <EmptyState
          className="mt-4"
          icon={ClipboardList}
          title="No mocks yet"
          body="A full-length mock is the only thing that produces a real 400–1600 score."
          action={
            <Link
              to="/practice"
              className="btn-brand group inline-flex items-center gap-1.5 rounded-lg bg-grad-brand px-3.5 py-2 text-xs font-bold text-white"
            >
              Take one <ArrowRight className="arrow-slide h-3.5 w-3.5" />
            </Link>
          }
        />
      ) : (
        <ul className="mt-2 divide-y divide-brand-400/30 stagger-fast">
          {mocks.slice(0, 6).map((m) => (
            <li
              key={m.id}
              className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-brand-800"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">
                  {m.completed_at ? format(new Date(m.completed_at), "MMM d, yyyy") : "—"}
                </div>
                <div className="text-xs text-brand-100">
                  R&W {m.rw_score ?? "—"} · Math {m.math_score ?? "—"}
                </div>
              </div>
              <div className="shrink-0 text-xl font-black tabular-nums text-white">
                {m.score ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/**
 * Recharts tooltip. The default is a white box with a hard border; this matches
 * the app's rounded, shadowed surfaces instead.
 */
function ChartTip({
  active,
  payload,
  label,
  suffix = "",
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  suffix?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-brand-400/40 bg-brand-600/95 px-3 py-2 shadow-float backdrop-blur">
      {label != null && (
        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-200">{label}</div>
      )}
      <div className="text-sm font-black tabular-nums text-white">
        {payload[0].value}
        <span className="text-xs font-medium text-brand-100">{suffix}</span>
      </div>
    </div>
  );
}

/** Loading state that mirrors the real layout, so nothing jumps on arrival. */
function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-3" />
        <Skeleton className="h-[360px] rounded-2xl lg:col-span-2" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        <Skeleton className="h-52 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-52 rounded-2xl" />
      </div>
    </div>
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
      desc: "Benchmark where you are with a full-length mock exam.",
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
