import { Minus, TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { AnimatedNumber } from "@/components/AnimatedNumber";

/**
 * Metric display primitives: badges, deltas, and the small stat tiles that run
 * across the dashboard and analysis pages.
 */

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export type Tone = "excellent" | "good" | "fair" | "low" | "neutral";

const TONE_BG: Record<Tone, string> = {
  excellent: "bg-emerald-50 text-emerald-700 ring-emerald-600/10",
  good: "bg-blue-50 text-blue-700 ring-blue-600/10",
  fair: "bg-amber-50 text-amber-700 ring-amber-600/10",
  low: "bg-slate-100 text-slate-600 ring-slate-500/10",
  neutral: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const TONE_DOT: Record<Tone, string> = {
  excellent: "bg-emerald-500",
  good: "bg-blue-600",
  fair: "bg-amber-500",
  low: "bg-slate-400",
  neutral: "bg-slate-400",
};

/** Pill with a leading status dot. */
export function Badge({
  label,
  tone = "neutral",
  dot = true,
  className,
}: {
  label: string;
  tone?: Tone;
  dot?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "pop-in inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1",
        TONE_BG[tone] ?? TONE_BG.neutral,
        className,
      )}
    >
      {dot && <span className={cx("h-1.5 w-1.5 rounded-full", TONE_DOT[tone] ?? TONE_DOT.neutral)} />}
      {label}
    </span>
  );
}

/**
 * Signed change indicator. Zero renders neutral rather than green, so a flat
 * result isn't mistaken for an improvement.
 */
export function Delta({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const rounded = Math.round(value);
  if (rounded === 0) {
    return (
      <span
        className={cx(
          "inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-600",
          className,
        )}
      >
        <Minus className="h-3 w-3" /> No change {suffix}
      </span>
    );
  }
  const up = rounded > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={cx(
        "pop-in inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
        up ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700",
        className,
      )}
    >
      <Icon className="h-3 w-3" />
      {up ? "+" : "−"}
      {Math.abs(rounded)} {suffix}
    </span>
  );
}

/**
 * Compact stat tile: icon, animated value, label. Used in the four-across rows
 * on the dashboard and in the admin overview.
 */
export function StatTile({
  icon: Icon,
  value,
  label,
  suffix = "",
  hint,
  loading = false,
  accent = "brand",
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  suffix?: string;
  hint?: string;
  loading?: boolean;
  accent?: "brand" | "emerald" | "amber" | "slate";
}) {
  const accents: Record<string, string> = {
    brand: "bg-blue-50 text-blue-600",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-500",
  };
  return (
    <div className="group flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-panel lift">
      <span
        className={cx(
          "tile-invert grid h-10 w-10 shrink-0 place-items-center rounded-xl",
          accents[accent],
        )}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} />
      </span>
      <div className="min-w-0">
        {loading ? (
          <div className="skeleton h-6 w-16 rounded" />
        ) : (
          <div className="text-xl font-black leading-tight text-slate-900">
            <AnimatedNumber value={value} suffix={suffix} />
          </div>
        )}
        <div className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{label}</div>
        {hint && <div className="truncate text-[10px] text-slate-400">{hint}</div>}
      </div>
    </div>
  );
}

/** Labelled horizontal bar, for per-section breakdowns. */
export function MeterRow({
  label,
  value,
  max = 100,
  barClass = "bg-blue-600",
  display,
}: {
  label: string;
  value: number | null;
  max?: number;
  barClass?: string;
  display?: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-medium text-slate-600">{label}</span>
        <span className="shrink-0 font-bold tabular-nums text-slate-900">
          {display ?? (value == null ? "—" : `${value}%`)}
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cx("sweep-right h-full rounded-full transition-[width] duration-700", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
