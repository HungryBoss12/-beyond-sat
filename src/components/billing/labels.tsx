import type { MemberStatus } from "@/lib/classes/types";
import { balanceKind, formatUzs } from "@/lib/billing/money";
import { cn } from "@/lib/utils";
import { KIND_META, STATUS_META } from "./meta";

/** Icon + word, then the absolute amount. Never colour alone. */
export function BalanceLabel({ balance, className }: { balance: bigint; className?: string }) {
  const kind = balanceKind(balance);
  const meta = KIND_META[kind];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 whitespace-nowrap", className)}>
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold",
          meta.tone,
        )}
      >
        <Icon className="h-3 w-3" aria-hidden="true" />
        {meta.label}
      </span>
      {kind !== "settled" && (
        <span className="truncate font-bold tabular-nums">{formatUzs(balance)}</span>
      )}
    </span>
  );
}

export function StatusLabel({ status, className }: { status: MemberStatus; className?: string }) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap text-xs", className)}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {meta.label}
    </span>
  );
}
