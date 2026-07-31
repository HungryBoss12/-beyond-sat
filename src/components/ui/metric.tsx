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

/**
 * Tones are steps of the brand ramp rather than hues — the palette is white +
 * #11269D only, so a green "Excellent" badge would be the one off-palette
 * colour on the screen. Rank now reads through lightness: brighter = better.
 * The badge label itself still says which band it is, so no meaning is lost.
 */
const TONE_BG: Record<Tone, string> = {
  excellent: "bg-brand-400 text-white ring-brand-200/40",
  good: "bg-brand-500 text-white ring-brand-300/30",
  fair: "bg-brand-700 text-white ring-brand-400/30",
  low: "bg-brand-800 text-brand-100 ring-brand-400/20",
  neutral: "bg-brand-800 text-brand-100 ring-brand-400/20",
};

const TONE_DOT: Record<Tone, string> = {
  excellent: "bg-white",
  good: "bg-brand-100",
  fair: "bg-brand-200",
  low: "bg-brand-300",
  neutral: "bg-brand-300",
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
          "inline-flex items-center gap-1 rounded-full bg-brand-800 px-2 py-0.5 text-[11px] font-bold text-brand-100",
          className,
        )}
      >
        <Minus className="h-3 w-3" /> No change {suffix}
      </span>
    );
  }
  const up = rounded > 0;
  const Icon = up ? TrendingUp : TrendingDown;
  /* Direction is carried by the arrow icon and the +/− sign rather than by
     red/green, which would break the white + #11269D palette. A gain gets the
     brighter shade so it still reads as the positive state. */
  return (
    <span
      className={cx(
        "pop-in inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold text-white",
        up ? "bg-brand-400" : "bg-brand-800 ring-1 ring-brand-400/40",
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
  /* All four accents now live in the brand family; they differ in depth only,
     which is enough to tell the tiles apart on a #11269D surface. */
  const accents: Record<string, string> = {
    brand: "bg-brand-400 text-white",
    emerald: "bg-brand-300 text-white",
    amber: "bg-brand-200 text-brand-900",
    slate: "bg-brand-800 text-brand-100",
  };
  return (
    <div className="group flex items-center gap-3.5 rounded-2xl border border-brand-400/30 bg-brand-600 px-4 py-3.5 shadow-panel lift">
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
          <div className="text-xl font-black leading-tight text-white">
            <AnimatedNumber value={value} suffix={suffix} />
          </div>
        )}
        <div className="mt-0.5 truncate text-[11px] font-medium text-brand-100">{label}</div>
        {hint && <div className="truncate text-[10px] text-brand-100">{hint}</div>}
      </div>
    </div>
  );
}

/** Labelled horizontal bar, for per-section breakdowns. */
export function MeterRow({
  label,
  value,
  max = 100,
  barClass = "bg-brand-300",
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
        <span className="truncate font-medium text-brand-100">{label}</span>
        <span className="shrink-0 font-bold tabular-nums text-white">
          {display ?? (value == null ? "—" : `${value}%`)}
        </span>
      </div>
      {/* Track is the deep shade so the lighter fill reads against it. */}
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-brand-800">
        <div
          className={cx("sweep-right h-full rounded-full transition-[width] duration-700", barClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
