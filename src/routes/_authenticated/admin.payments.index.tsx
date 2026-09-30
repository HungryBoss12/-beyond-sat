import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Wallet } from "lucide-react";
import { StatTile } from "@/components/ui/metric";
import { EmptyState } from "@/components/ui/panel";
import { TableSkeleton } from "@/components/ui/skeletons";
import { applyRecurringFees, chargeMonth, listBalances } from "@/lib/billing/api";
import { asInt, type BalanceRow } from "@/lib/billing/types";
import { formatUzs } from "@/lib/billing/money";
import { CLASS_CONTROL } from "@/components/classes/control";
import { RankBadge } from "@/components/classes/RankBadge";

const searchSchema = z.object({
  q: z.string().catch(""),
  kind: z.string().catch(""),
  status: z.string().catch(""),
  rank: z.string().catch(""),
});

export const Route = createFileRoute("/_authenticated/admin/payments/")({
  validateSearch: (search) => searchSchema.parse(search),
  component: PaymentsPage,
});

function PaymentsPage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      await applyRecurringFees();
      setRows(
        await listBalances({
          search: search.q,
          kind: search.kind,
          status: search.status,
          rank: search.rank,
        }),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load balances");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.q, search.kind, search.status, search.rank]);

  const debtors = rows.filter((row) => asInt(row.balance) < 0);
  const settled = rows.filter((row) => asInt(row.balance) === 0);
  const owed = debtors.reduce((sum, row) => sum + Math.abs(asInt(row.balance)), 0);

  return (
    <div className="space-y-4 text-brand-900">
      <Link to="/admin/classes" className="tap text-sm font-bold uppercase text-brand-900">
        ← Back
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-black uppercase">Payments</h1>
        <div className="flex gap-2">
          <button
            type="button"
            className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white"
            onClick={() => {
              if (!confirm("Apply missing monthly charges?")) return;
              void applyRecurringFees()
                .then((n) =>
                  toast.success(
                    n ? `Applied ${n} new charges` : "All recurring fees already up to date",
                  ),
                )
                .then(load);
            }}
          >
            Apply recurring fees
          </button>
          <Link
            to="/admin/payments/ledger"
            className="tap rounded-full bg-brand-800 px-4 py-2 text-sm font-bold text-white"
          >
            Ledger
          </Link>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          icon={Wallet}
          label="Total owed"
          value={owed}
          hint={`${debtors.length} debtors`}
        />
        <StatTile
          icon={Wallet}
          label="Credits / prepaid"
          value={rows
            .filter((row) => asInt(row.balance) > 0)
            .reduce((s, r) => s + asInt(r.balance), 0)}
          hint={`${settled.length} settled`}
        />
        <StatTile
          icon={Wallet}
          label="Expected this month"
          value={rows.reduce((s, r) => s + asInt(r.monthly_fee), 0)}
          hint="Sum of current fees"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {["", "debt", "credit", "settled"].map((kind) => (
          <button
            key={kind || "all"}
            type="button"
            className="tap rounded-full bg-brand-800 px-3 py-1 text-xs font-bold uppercase text-white"
            onClick={() => void navigate({ search: { ...search, kind } })}
          >
            {kind || "All balances"}
          </button>
        ))}
        <input
          className={CLASS_CONTROL + " max-w-xs"}
          placeholder="Search"
          defaultValue={search.q}
          onBlur={(e) => void navigate({ search: { ...search, q: e.target.value } })}
        />
        {(search.q || search.kind || search.status || search.rank) && (
          <button
            type="button"
            className="tap text-xs font-bold uppercase text-brand-900"
            onClick={() => void navigate({ search: { q: "", kind: "", status: "", rank: "" } })}
          >
            CLEAR FILTERS
          </button>
        )}
      </div>
      {loading ? (
        <TableSkeleton />
      ) : error ? (
        <p className="text-sm">
          {error}{" "}
          <button type="button" className="font-bold underline" onClick={() => void load()}>
            Retry
          </button>
        </p>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No balances"
          body="Students appear here after they join a class."
        />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-brand-400/40 bg-white text-brand-900">
          <table className="w-full min-w-[720px] text-left text-sm text-brand-900">
            <thead className="text-[10px] font-bold uppercase text-brand-700">
              <tr>
                <th className="p-3">Student</th>
                <th>Balance</th>
                <th>Fee</th>
                <th>Rank</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user_id} className="border-t border-brand-400/30">
                  <td className="p-3">
                    <div className="font-bold">{row.full_name || row.username}</div>
                    <div className="text-xs uppercase text-brand-700">
                      {row.class_name} · {row.phone || "no phone"} · {row.status}
                    </div>
                  </td>
                  <td className="tabular-nums">
                    {asInt(row.balance) < 0
                      ? "Debt "
                      : asInt(row.balance) > 0
                        ? "Credit "
                        : "Settled "}
                    {formatUzs(Math.abs(asInt(row.balance)))}
                  </td>
                  <td>{row.monthly_fee ? formatUzs(asInt(row.monthly_fee)) : "—"}</td>
                  <td>
                    <RankBadge letter={row.rank_letter} total={row.total_score} />
                  </td>
                  <td className="space-x-2 p-3 text-xs font-bold">
                    <Link
                      to="/admin/classes/$classId/students/$userId"
                      params={{ classId: row.class_id, userId: row.user_id }}
                    >
                      PROFILE
                    </Link>
                    <button
                      type="button"
                      onClick={() =>
                        void chargeMonth(row.user_id, new Date().toISOString().slice(0, 7) + "-01")
                          .then(load)
                          .catch((err) =>
                            toast.error(err instanceof Error ? err.message : "Charge failed"),
                          )
                      }
                    >
                      CHARGE MONTH
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
