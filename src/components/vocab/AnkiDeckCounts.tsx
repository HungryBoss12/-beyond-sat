import { cn } from "@/lib/utils";

type Tone = "new" | "learning" | "review";

const TONE_CLASS: Record<Tone, string> = {
  new: "bg-[#2563eb] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
  learning: "bg-[#dc2626] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
  review: "bg-[#059669] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.2)]",
};

function CountPill({ value, tone }: { value: number; tone: Tone }) {
  const active = value > 0;
  return (
    <span
      className={cn(
        "inline-flex min-w-[1.75rem] items-center justify-center rounded-md px-1.5 py-0.5 text-xs font-bold tabular-nums",
        active ? TONE_CLASS[tone] : "bg-brand-800/80 text-brand-200/70 ring-1 ring-brand-400/30",
      )}
    >
      {value}
    </span>
  );
}

export function AnkiDeckCounts({
  newCount,
  learningCount,
  reviewCount,
  className,
}: {
  newCount: number;
  learningCount: number;
  reviewCount: number;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <CountPill value={newCount} tone="new" />
      <CountPill value={learningCount} tone="learning" />
      <CountPill value={reviewCount} tone="review" />
    </div>
  );
}

export function AnkiDeckCountLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3 text-xs font-semibold text-brand-100",
        className,
      )}
    >
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-[#2563eb]" aria-hidden />
        New
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-[#dc2626]" aria-hidden />
        Learning
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-sm bg-[#059669]" aria-hidden />
        Review
      </span>
    </div>
  );
}
