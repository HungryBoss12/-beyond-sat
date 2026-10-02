import { EllipsisVertical, ListChecks } from "lucide-react";
import { EmptyState } from "@/components/ui/panel";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { IconButton } from "@/components/ui/icon-button";
import { txMethodOrPeriod, txSign, txType } from "@/lib/billing/ledger";
import { formatUzs } from "@/lib/billing/money";
import type { LedgerRow } from "@/lib/billing/types";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { cn } from "@/lib/utils";

export type TxRow = LedgerRow & { student?: string };

export function TransactionsTable({
  rows,
  showStudent = true,
  showGroup = false,
  onVoid,
  emptyTitle = "No transactions",
  emptyBody = "Payments and fee charges will appear here.",
}: {
  rows: TxRow[];
  showStudent?: boolean;
  showGroup?: boolean;
  onVoid?: (row: TxRow) => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const glow = usePointerGlow<HTMLDivElement>();
  if (rows.length === 0) {
    return <EmptyState icon={ListChecks} title={emptyTitle} body={emptyBody} />;
  }
  return (
    <div
      ref={glow}
      className="reveal-surface overflow-x-auto overflow-y-clip rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-panel"
    >
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead className="text-[11px] font-bold text-white">
          <tr>
            <th className="whitespace-nowrap p-3">Date</th>
            {showStudent && <th className="whitespace-nowrap p-3">Student</th>}
            <th className="whitespace-nowrap p-3">Type</th>
            {showGroup && <th className="whitespace-nowrap p-3">Group</th>}
            <th className="whitespace-nowrap p-3 text-right">Amount</th>
            <th className="whitespace-nowrap p-3">Method / period</th>
            <th className="p-3">Note</th>
            {onVoid && <th className="p-3" aria-label="Actions" />}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={cn(
                "border-t border-brand-400/30",
                row.voided_at && "text-brand-200 line-through",
              )}
            >
              <td className="whitespace-nowrap p-3 tabular-nums">{row.occurred_on}</td>
              {showStudent && <td className="whitespace-nowrap p-3 font-bold">{row.student}</td>}
              <td className="whitespace-nowrap p-3">
                {txType(row)}
                {row.prorate_lessons != null && (
                  <span className="ml-1 text-xs text-white">
                    {row.prorate_lessons}/{row.prorate_total}
                  </span>
                )}
              </td>
              {showGroup && <td className="whitespace-nowrap p-3">{row.group_name ?? "—"}</td>}
              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums">
                {txSign(row)}
                {formatUzs(row.amount_uzs)}
              </td>
              <td className="whitespace-nowrap p-3">{txMethodOrPeriod(row)}</td>
              <td className="max-w-[18rem] truncate p-3 text-white" title={row.note ?? ""}>
                {row.voided_at ? `Voided: ${row.void_reason ?? ""}` : (row.note ?? "")}
              </td>
              {onVoid && (
                <td className="p-2 text-right">
                  {!row.voided_at && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <IconButton
                          icon={EllipsisVertical}
                          label="Row menu"
                          className="text-white hover:bg-brand-500"
                        />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onVoid(row)}>Void entry</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
