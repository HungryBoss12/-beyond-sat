import type { LucideIcon } from "lucide-react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { compactUzs, formatUzs, signedUzs, toUzs, type UzsLike } from "@/lib/billing/money";

/**
 * Stat tile for money and other text. Millions are the full amount
 * ("1 500 000 UZS"); only billions are shortened.
 */
export function MoneyTile({
  icon: Icon,
  label,
  amount,
  text,
  kind,
  hint,
  edge = null,
  signed = false,
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
  /** With and without discount, drawn at the right edge of the tile. */
  edge?: { without: UzsLike; with: UzsLike } | null;
  /** Keep a leading minus when the amount is negative. */
  signed?: boolean;
  loading?: boolean;
}) {
  const ref = usePointerGlow<HTMLDivElement>();
  const negative = signed && amount != null && toUzs(amount) < 0n;
  const full =
    amount == null ? (text ?? "—") : negative ? signedUzs(amount) : formatUzs(amount);
  const shown =
    amount == null ? (text ?? "—") : negative ? `-${compactUzs(amount)}` : compactUzs(amount);
  const amountClass =
    shown.length > 18 ? "text-base" : shown.length > 14 ? "text-lg" : "text-xl";
  const edgeLabel = edge
    ? ` Without ${formatUzs(edge.without)}. With ${formatUzs(edge.with)}.`
    : "";
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
                aria-label={`${label}: ${full}${kind ? ` ${kind}` : ""}${edgeLabel}`}
                className={`flex min-w-0 items-baseline gap-1.5 font-black leading-tight text-white outline-none focus-visible:ring-2 focus-visible:ring-brand-200 ${amountClass}`}
              >
                <span key={shown} className="flash-tint min-w-0 truncate rounded-md tabular-nums">
                  {shown}
                </span>
                {kind && <span className="shrink-0 text-xs font-bold text-white">{kind}</span>}
              </div>
            </TooltipTrigger>
            <TooltipContent className="bg-brand-800 tabular-nums text-white">
              <div>{full}</div>
              {edge && (
                <>
                  <div>Without {formatUzs(edge.without)}</div>
                  <div>With {formatUzs(edge.with)}</div>
                </>
              )}
            </TooltipContent>
          </Tooltip>
        )}
        <div className="mt-0.5 truncate text-[11px] font-medium text-white">{label}</div>
        {hint && <div className="truncate text-[10px] text-white">{hint}</div>}
        {edge && !loading && (
          <div className="mt-1 space-y-0.5 text-[10px] font-bold leading-tight text-white">
            <div className="truncate">Without {formatUzs(edge.without)}</div>
            <div className="truncate">With {formatUzs(edge.with)}</div>
          </div>
        )}
      </div>
    </div>
  );
}
