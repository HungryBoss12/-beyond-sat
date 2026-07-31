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
 *
 * Recharts takes colours as props rather than classes, so the brand ramp is
 * repeated as hexes here. They are the same values as --color-brand-* in
 * styles.css: 100 #b8c0e8, 200 #8a98d6, 400 #2e43c4, 500 #1a2fa8, 700 #0e1f82.
 */

const SCORE_TREND = [
  { month: "Jan", score: 1200 },
  { month: "Feb", score: 1265 },
  { month: "Mar", score: 1310 },
  { month: "Apr", score: 1375 },
  { month: "May", score: 1430 },
  { month: "Jun", score: 1520 },
];

const ACCURACY = [{ name: "accuracy", value: 98, fill: "#ffffff" }];

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
    return <circle cx={cx} cy={cy} r={3} fill="#ffffff" stroke="#2e43c4" strokeWidth={1.5} />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.5} fill="#ffffff" stroke="#2e43c4" strokeWidth={2} />
      {/* The bubble inverts — light chip, deep text — so it reads on the blue card. */}
      <rect x={cx - 34} y={cy - 42} width={68} height={30} rx={6} fill="#ffffff" stroke="#8a98d6" />
      <text x={cx} y={cy - 29} textAnchor="middle" fontSize={11} fontWeight={700} fill="#0e1f82">
        1520
      </text>
      <text x={cx} y={cy - 18} textAnchor="middle" fontSize={8} fill="#1a2fa8">
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
      className="flex overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float"
    >
      {/* Icon rail — desktop only */}
      <div className="hidden w-14 shrink-0 flex-col items-center gap-4 bg-brand-800 py-5 md:flex">
        {RAIL.map(({ icon: Icon, active }, i) => (
          <div
            key={i}
            className={
              "grid h-9 w-9 place-items-center rounded-lg " +
              (active ? "bg-brand-400 text-white" : "text-brand-100")
            }
          >
            <Icon className="h-[18px] w-[18px]" strokeWidth={2} />
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-5">
          {/* Your Progress */}
          <div className="rounded-xl border border-brand-400/40 bg-brand-800 p-4 md:col-span-3">
            <div className="text-[11px] font-bold text-brand-100">Your Progress</div>

            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-3xl font-black tracking-tight text-white">1520</span>
              <span className="text-xs font-bold text-brand-100">/1600</span>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-2">
              {/* "Excellent" was emerald; the rank now reads through the lit brand
                  step, and the delta through its ↑ sign rather than green. */}
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-400 px-2 py-0.5 text-[10px] font-bold text-white">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                Excellent
              </span>
              <span className="text-[10px] font-bold text-brand-100">↑ 120 vs last test</span>
            </div>

            <div className="mt-3 h-[124px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={SCORE_TREND} margin={{ top: 34, right: 18, bottom: 0, left: -14 }}>
                  <CartesianGrid stroke="#1a2fa8" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#b8c0e8", fontSize: 9 }}
                  />
                  <YAxis
                    domain={[1000, 1600]}
                    ticks={[1000, 1200, 1400, 1600]}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "#b8c0e8", fontSize: 9 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="score"
                    stroke="#ffffff"
                    strokeWidth={2}
                    dot={<TrendDot />}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Overall Accuracy */}
          <div className="rounded-xl border border-brand-400/40 bg-brand-800 p-4 md:col-span-2">
            <div className="text-[11px] font-bold text-brand-100">Overall Accuracy</div>

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
                    background={{ fill: "#0e1f82" }}
                    isAnimationActive={false}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 grid place-content-center text-center">
                <div className="text-xl font-black leading-none text-white">98%</div>
                <div className="mt-0.5 text-[9px] font-bold text-brand-100">Excellent</div>
              </div>
            </div>

            <div className="mt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[10px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white" />
                <span className="text-brand-100">Reading &amp; Writing</span>
                <span className="ml-auto font-bold text-white">760 / 800</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand-200" />
                <span className="text-brand-100">Math</span>
                <span className="ml-auto font-bold text-white">760 / 800</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stat chips */}
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CHIPS.map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 rounded-xl border border-brand-400/40 bg-brand-800 px-3 py-2.5"
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-brand-400 text-white">
                <Icon className="h-3.5 w-3.5" strokeWidth={2} />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-black leading-tight text-white">
                  {value}
                </span>
                <span className="block truncate text-[10px] text-brand-100">{label}</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
