import type { LucideIcon } from "lucide-react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactUzs, formatUzs, type UzsLike } from "@/lib/billing/money";

/**
 * StatTile for money and other text values. The value is compacted ("1.2 mln UZS")
 * and truncated so a 12-digit amount can never widen the card; the full amount
 * is in the tooltip and the accessible label.
 */
export function MoneyTile({
  icon: Icon,
  label,
  amount,
  text,
  kind,
  hint,
  loading = false,
}: {
  icon: LucideIcon;
  label: string;
  amount?: UzsLike | null;
  /** Shown instead of an amount (e.g. "2 of 8 groups"). */
  text?: string;
  /** Word shown next to the amount, e.g. "debt". */
  kind?: string;
  hint?: string;
  loading?: boolean;
}) {
  const ref = usePointerGlow<HTMLDivElement>();
  const full = amount == null ? (text ?? "—") : formatUzs(amount);
  const shown = amount == null ? (text ?? "—") : compactUzs(amount);
  return (
    <div
      ref={ref}
      className="reveal-surface group flex min-w-0 items-center gap-3.5 rounded-2xl border border-brand-400/30 bg-brand-600 px-4 py-3.5 shadow-panel lift"
    >
      <span className="tile-invert grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-400 text-white">
        <Icon className="h-[18px] w-[18px]" strokeWidth={2.1} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        {loading ? (
          <div className="skeleton h-6 w-24 rounded" />
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                tabIndex={0}
                aria-label={`${label}: ${full}${kind ? ` ${kind}` : ""}`}
                className="flex min-w-0 items-baseline gap-1.5 text-xl font-black leading-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-200"
              >
                <span className="truncate tabular-nums">{shown}</span>
                {kind && <span className="shrink-0 text-xs font-bold text-white">{kind}</span>}
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-brand-800 tabular-nums text-white">{full}</TooltipContent>
          </Tooltip>
        )}
        <div className="mt-0.5 truncate text-[11px] font-medium text-white">{label}</div>
        {hint && <div className="truncate text-[10px] text-white">{hint}</div>}
      </div>
    </div>
  );
}
