import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, Download } from "lucide-react";
import { toast } from "sonner";
import { TableSkeleton } from "@/components/ui/skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { TransactionsTable, type TxRow } from "@/components/billing/TransactionsTable";
import { txMethodOrPeriod, txSign, txType } from "@/lib/billing/ledger";
import { VoidDialog } from "@/components/billing/VoidDialog";
import { listAllLedger, listBalances, voidEntry } from "@/lib/billing/api";
import { downloadCsv, toCsv } from "@/lib/billing/csv";
import { tashkentToday } from "@/lib/billing/dates";
import { formatUzs } from "@/lib/billing/money";

export const Route = createFileRoute("/_authenticated/admin/payments/ledger")({
  component: LedgerPage,
});

function LedgerPage() {
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [voiding, setVoiding] = useState<TxRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [ledger, people] = await Promise.all([listAllLedger(), listBalances({})]);
      const names = new Map(people.map((p) => [p.user_id, p.full_name || p.username || "—"]));
      setRows(ledger.map((row) => ({ ...row, student: names.get(row.user_id ?? "") ?? "—" })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the ledger");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function exportCsv() {
    downloadCsv(
      `ledger-${tashkentToday()}.csv`,
      toCsv([
        [
          "Date",
          "Student",
          "Type",
          "Group",
          "Prorated",
          "Amount (UZS)",
          "Method / period",
          "Note",
          "Voided",
        ],
        ...rows.map((row) => [
          row.occurred_on,
          row.student,
          txType(row),
          row.group_name,
          row.prorate_lessons == null ? "" : `${row.prorate_lessons}/${row.prorate_total}`,
          `${txSign(row) === "−" ? "-" : ""}${row.amount_uzs}`,
          txMethodOrPeriod(row),
          row.note,
          row.voided_at ? row.void_reason : "",
        ]),
      ]),
    );
  }

  return (
    <div className="space-y-4 text-brand-900">
      <Link
        to="/admin/payments"
        className="tap inline-flex items-center gap-1 text-sm font-bold text-brand-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Balances
      </Link>
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-black tracking-tight md:text-3xl">Ledger</h1>
        <IconButton icon={Download} label="Export CSV" variant="outline" onClick={exportCsv} />
      </div>
      {loading ? (
        <TableSkeleton />
      ) : (
        <>
          <TransactionsTable rows={rows} showGroup onVoid={setVoiding} />
          <p className="text-xs text-brand-700">
            {rows.length} transactions · recurring group fees
          </p>
        </>
      )}
      <VoidDialog
        open={voiding != null}
        title="Void entry"
        description={
          voiding
            ? `${voiding.student} · ${txType(voiding)} · ${formatUzs(voiding.amount_uzs)} · ${voiding.occurred_on}`
            : ""
        }
        onClose={() => setVoiding(null)}
        onVoid={async (reason) => {
          if (!voiding) return;
          await voidEntry(voiding.id, reason);
          toast.success("Entry voided");
          await load();
        }}
      />
    </div>
  );
}
