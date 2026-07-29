import {
  LayoutDashboard,
  BookOpen,
  BarChart3,
  User,
  ClipboardList,
  TrendingUp,
  Trophy,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
} from "recharts";

/**
 * Marketing-only preview of the student dashboard, used as the hero visual.
 * Everything here is static demo data — it never touches Supabase. Charts use
 * recharts to match the real dashboard/analysis pages.
 */

const SCORE_TREND = [
  { month: "Jan", score: 1200 },
  { month: "Feb", score: 1265 },
  { month: "Mar", score: 1310 },
  { month: "Apr", score: 1375 },
  { month: "May", score: 1430 },
  { month: "Jun", score: 1520 },
];

const ACCURACY = [{ name: "accuracy", value: 98, fill: "#2563EB" }];

const RAIL: { icon: LucideIcon; active?: boolean }[] = [
  { icon: LayoutDashboard },
  { icon: BookOpen, active: true },
  { icon: BarChart3 },
  { icon: User },
];

const CHIPS: { icon: LucideIcon; value: string; label: string }[] = [
  { icon: ClipboardList, value: "18", label: "Tests Taken" },
  { icon: TrendingUp, value: "1420", label: "Average Score" },
  { icon: Trophy, value: "1520", label: "Best Score" },
  { icon: Target, value: "95%", label: "Accuracy" },
];

/** Renders the callout bubble on the final point of the trend line. */
function TrendDot({ cx, cy, index }: { cx?: number; cy?: number; index?: number }) {
  if (cx == null || cy == null) return null;
  const isLast = index === SCORE_TREND.length - 1;
  if (!isLast) {
    return <circle cx={cx} cy={cy} r={3} fill="#2563EB" stroke="#fff" strokeWidth={1.5} />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill="#2563EB" stroke="#fff" strokeWidth={2} />
      <rect x={cx - 34} y={cy - 42} width={68} height={30} rx={6} fill="#fff" stroke="#E2E8F0" />
      <text x={cx} y={cy - 29} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0F172A">
        1520
      </text>
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize={8} fill="#64748B">
        Jun 1, 2024
      </text>
    </g>
  );
}

export function DashboardMockup() {
  return (
    <div
      role="img"
      aria-label="Preview of the BeyondSAT dashboard showing a 1520 score, an upward six-month trend, and 98% overall accuracy"
      className="flex overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
    >
      {/* Icon rail — desktop only */}
      <div className="hidden md:flex w-14 shrink-0 flex-col items-center gap-4 bg-blue-600 py-5">
        {RAIL.map(({ icon: Icon, active }, i) => (
          <div
            key={i}
            className={
              "grid h-9 w-9 place-items-center rounded-lg " +
              (active ? "bg-white/25 text-white" : "text-white/60")
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-5">
          {/* Your Progress */}
          <div className="md:col-span-3 rounded-xl border border-slate-200 p-4">
            <div className="text-[11px] font-semibold text-slate-500">Your Progress</div>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-bold tracking-tight text-slate-900">1520</span>
              <span className="text-xs font-medium text-slate-400">/1600</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Excellent
              </span>
              <span className="text-[10px] font-medium text-emerald-600">↑ 120 vs last test</span>
            </div>

            <div className="mt-3 h-[124px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SCORE_TREND} margin={{ top: 34, right: 18, bottom: 0, left: -14 }}>
                  <CartesianGrid stroke="#F1F5F9" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                  />
                  <YAxis
                    domain={[1000, 1600]}
                    ticks={[1000, 1200, 1400, 1600]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#94A3B8", fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#2563EB"
                    strokeWidth={2}
                    dot={<TrendDot />}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall Accuracy */}
          <div className="md:col-span-2 rounded-xl border border-slate-200 p-4">
            <div className="text-[11px] font-semibold text-slate-500">Overall Accuracy</div>

            <div className="relative mx-auto mt-1 h-[112px] w-[112px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart
                  data={ACCURACY}
                  innerRadius="74%"
                  outerRadius="100%"
                  startAngle={90}
                  endAngle={-270}
                >
                  <PolarAngleAxis type="number" domain={[0, 100]} tick={false} axisLine={false} />
                  <RadialBar
                    dataKey="value"
                    cornerRadius={10}
                    background={{ fill: "#EFF6FF" }}
                    isAnimationActive={false}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <div className="text-xl font-bold leading-none text-slate-900">98%</div>
                <div className="mt-0.5 text-[9px] font-medium text-slate-400">Excellent</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />
                <span className="text-slate-600">Reading &amp; Writing</span>
                <span className="ml-auto font-semibold text-slate-900">760 / 800</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
                <span className="text-slate-600">Math</span>
                <span className="ml-auto font-semibold text-slate-900">760 / 800</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CHIPS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-slate-200 px-3 py-2.5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-blue-50 text-blue-600">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-tight text-slate-900">
                  {value}
                </span>
                <span className="block truncate text-[10px] text-slate-500">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
