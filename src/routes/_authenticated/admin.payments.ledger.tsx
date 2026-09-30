import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { listBalances, studentLedger } from "@/lib/billing/api";
import { asInt, type LedgerRow } from "@/lib/billing/types";
import { formatUzs } from "@/lib/billing/money";
import { TableSkeleton } from "@/components/ui/skeletons";

export const Route = createFileRoute("/_authenticated/admin/payments/ledger")({
  component: LedgerPage,
});

function LedgerPage() {
  const [rows, setRows] = useState<(LedgerRow & { student: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const balances = await listBalances({}).catch(() => []);
      const all: (LedgerRow & { student: string })[] = [];
      for (const person of balances.slice(0, 40)) {
        const ledger = await studentLedger(person.user_id).catch(() => []);
        for (const row of ledger)
          all.push({ ...row, student: person.full_name || person.username || person.user_id });
      }
      all.sort((a, b) => b.occurred_on.localeCompare(a.occurred_on));
      setRows(all.slice(0, 50));
      setLoading(false);
    })();
  }, []);

  function exportCsv() {
    const header = "date,student,kind,amount,method,note,voided";
    const body = rows
      .map((row) =>
        [
          row.occurred_on,
          row.student,
          row.kind,
          asInt(row.amount_uzs),
          row.method ?? "",
          row.note ?? "",
          row.voided_at ? "yes" : "",
        ].join(","),
      )
      .join("\n");
    const blob = new Blob([header + "\n" + body], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "ledger.csv";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4 text-brand-900">
      <Link to="/admin/payments" className="tap text-sm font-bold uppercase text-brand-900">
        ← Back
      </Link>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black uppercase">Ledger</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="tap rounded-full bg-brand-800 px-4 py-2 text-sm font-bold uppercase text-white"
            onClick={exportCsv}
          >
            EXPORT CSV
          </button>
          <Link to="/admin/payments" className="tap text-sm font-bold uppercase text-brand-900">
            Balances
          </Link>
        </div>
      </div>
      {loading ? (
        <TableSkeleton />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-400/40 bg-white text-brand-900">
          <table className="w-full min-w-[720px] text-left text-sm text-brand-900">
            <thead className="text-[10px] font-bold uppercase text-brand-700">
              <tr>
                <th className="p-3">Date</th>
                <th>Student</th>
                <th>Kind</th>
                <th>Amount</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    "border-t border-brand-400/30 " +
                    (row.voided_at ? "line-through opacity-60" : "")
                  }
                >
                  <td className="p-3">{row.occurred_on}</td>
                  <td>{row.student}</td>
                  <td>
                    {row.kind}
                    {row.source === "auto" ? " · auto" : ""}
                  </td>
                  <td>{formatUzs(asInt(row.amount_uzs))}</td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
