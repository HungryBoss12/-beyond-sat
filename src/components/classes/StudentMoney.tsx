import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CalendarClock,
  CalendarRange,
  HandCoins,
  Receipt,
  ReceiptText,
  Repeat,
  Wallet,
  Banknote,
} from "lucide-react";
import { Panel, PanelHead } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/icon-button";
import { MoneyTile } from "@/components/billing/MoneyTile";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { RecordPaymentDialog, type PaymentTarget } from "@/components/billing/RecordPaymentDialog";
import { ActivationDateDialog } from "@/components/billing/ActivationDateDialog";
import { TransactionsTable, type TxRow } from "@/components/billing/TransactionsTable";
import { VoidDialog } from "@/components/billing/VoidDialog";
import { KIND_META } from "@/components/billing/meta";
import { chargeThisMonth } from "@/components/billing/charge";
import { setFeeOverride, studentBilling, studentLedger, voidEntry } from "@/lib/billing/api";
import { periodLabel } from "@/lib/billing/dates";
import { balanceKind, checkUzsInput, formatUzs, groupDigits } from "@/lib/billing/money";
import type { LedgerRow, StudentBillingRow } from "@/lib/billing/types";

/** Admin-only money block on the student profile (§6). */
export function StudentMoney({ userId, name }: { userId: string; name: string }) {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [billing, setBilling] = useState<StudentBillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<PaymentTarget | null>(null);
  const [activationOpen, setActivationOpen] = useState(false);
  const [voiding, setVoiding] = useState<TxRow | null>(null);

  const load = useCallback(async () => {
    try {
      const [rows, groups] = await Promise.all([studentLedger(userId), studentBilling(userId)]);
      setLedger(rows);
      setBilling(groups);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load the ledger");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const live = ledger.filter((row) => !row.voided_at);
  const charges = ledger.filter((row) => row.kind === "charge");
  const payments = ledger.filter((row) => row.kind === "payment");
  const liveCharges = live.filter((row) => row.kind === "charge");
  const livePayments = live.filter((row) => row.kind === "payment");
  const balance = live.reduce(
    (sum, row) =>
      row.kind === "payment" || row.kind === "discount"
        ? sum + row.amount_uzs
        : sum - row.amount_uzs,
    0n,
  );
  const kind = balanceKind(balance);
  const priced = billing.filter((g) => (g.monthly_fee_uzs ?? 0n) > 0n);
  const monthly = priced.reduce((sum, g) => sum + (g.monthly_fee_uzs ?? 0n), 0n);
  const joinGroups = priced.filter((g) => g.join_amount_uzs != null);
  const joinTotal = joinGroups.reduce((sum, g) => sum + (g.join_amount_uzs ?? 0n), 0n);
  const joinHint =
    joinGroups.length === 0
      ? "No priced groups"
      : joinGroups
          .map((g) =>
            g.join_total
              ? `${g.join_remaining}/${g.join_total} lessons · ${g.group_name}`
              : g.group_name,
          )
          .join(" · ");
  const anyActive = billing.some((g) => g.status === "active");

  const sum = (rows: LedgerRow[]) => rows.reduce((s, r) => s + r.amount_uzs, 0n);

  return (
    <section className="space-y-4" aria-label="Payments">
      <div className="flex flex-wrap items-center gap-2">
        <IconButton
          icon={HandCoins}
          label="Record payment"
          variant="brand"
          text="Record payment"
          onClick={() => setPayFor({ userId, name, balance, monthlyFee: monthly || null })}
        />
        <IconButton
          icon={CalendarClock}
          label="Activation date"
          variant="outline"
          onClick={() => setActivationOpen(true)}
        />
        <IconButton
          icon={ReceiptText}
          label="Charge this month"
          variant="outline"
          onClick={() =>
            void chargeThisMonth({ userId, name, active: anyActive }).then((ok) => {
              if (ok) return load();
            })
          }
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5 stagger">
        <MoneyTile
          icon={Wallet}
          label="Current balance"
          amount={kind === "settled" ? 0n : balance}
          kind={KIND_META[kind].label.toLowerCase()}
          loading={loading}
        />
        <MoneyTile
          icon={CalendarRange}
          label="Join-month fee"
          amount={joinGroups.length ? joinTotal : null}
          text="—"
          hint={joinHint}
          loading={loading}
        />
        <MoneyTile
          icon={Receipt}
          label="Total course fees"
          amount={sum(liveCharges)}
          hint={`${liveCharges.length} fee charge(s)`}
          loading={loading}
        />
        <MoneyTile
          icon={Banknote}
          label="Total paid"
          amount={sum(livePayments)}
          hint={`${livePayments.length} payment(s)`}
          loading={loading}
        />
        <MoneyTile
          icon={Repeat}
          label="Monthly fee"
          amount={priced.length ? monthly : null}
          text="Not set"
          hint={priced.length ? "Auto-charged each month" : "No priced groups"}
          loading={loading}
        />
      </div>

      {billing.length > 0 && (
        <Panel tone="soft" className="space-y-3">
          <PanelHead
            label="Per sub-class"
            hint="Balance is per student; payments are not split by group."
          />
          <ul className="divide-y divide-brand-400/30">
            {billing.map((group) => (
              <GroupFeeRow key={group.group_id} userId={userId} group={group} onSaved={load} />
            ))}
          </ul>
        </Panel>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-black">Course fee history</h3>
          <CourseFeeTable rows={charges} />
        </div>
        <div className="min-w-0 space-y-2">
          <h3 className="text-sm font-black">Payment history</h3>
          <PaymentTable rows={payments} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black">Full ledger</h3>
        <TransactionsTable
          rows={ledger}
          showStudent={false}
          showGroup
          onVoid={setVoiding}
          emptyTitle="No transactions yet"
          emptyBody="Charges, payments and voids for this student appear here."
        />
        <p className="text-xs text-brand-700">
          Join month is prorated by remaining lessons (e.g. 5/13). Later months are full price.
        </p>
      </div>

      <RecordPaymentDialog target={payFor} onClose={() => setPayFor(null)} onSaved={load} />
      <ActivationDateDialog
        open={activationOpen}
        userId={userId}
        name={name}
        groups={billing.map((g) => ({
          groupId: g.group_id,
          groupName: g.group_name,
          activatedOn: g.activated_on,
        }))}
        onClose={() => setActivationOpen(false)}
        onSaved={load}
      />
      <VoidDialog
        open={voiding != null}
        title="Void entry"
        description={
          voiding
            ? `${voiding.kind} · ${formatUzs(voiding.amount_uzs)} · ${voiding.occurred_on}`
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
    </section>
  );
}

function sourceLabel(row: LedgerRow): string {
  if (row.prorate_lessons != null) return "Prorated";
  return row.source === "auto" ? "Recurring" : "Manual";
}

function CourseFeeTable({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-brand-25 p-4 text-sm text-brand-700">No fee charges yet.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-panel">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="text-[11px] font-bold text-brand-100">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Period</th>
            <th className="p-3">Group</th>
            <th className="p-3">Source</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={
                "border-t border-brand-400/30 " +
                (row.voided_at ? "text-brand-200 line-through" : "")
              }
            >
              <td className="whitespace-nowrap p-3 tabular-nums">{row.occurred_on}</td>
              <td className="whitespace-nowrap p-3">{periodLabel(row.period)}</td>
              <td className="whitespace-nowrap p-3">{row.group_name ?? "—"}</td>
              <td className="whitespace-nowrap p-3">
                {sourceLabel(row)}
                {row.prorate_lessons != null && (
                  <span className="ml-1 text-xs text-brand-100">
                    {row.prorate_lessons}/{row.prorate_total}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums">
                {formatUzs(row.amount_uzs)}
              </td>
              <td className="max-w-[12rem] truncate p-3 text-brand-100" title={row.note ?? ""}>
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PaymentTable({ rows }: { rows: LedgerRow[] }) {
  if (rows.length === 0) {
    return <p className="rounded-2xl bg-brand-25 p-4 text-sm text-brand-700">No payments yet.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-400/40 bg-brand-600 text-white shadow-panel">
      <table className="w-full min-w-[420px] text-left text-sm">
        <thead className="text-[11px] font-bold text-brand-100">
          <tr>
            <th className="p-3">Date</th>
            <th className="p-3">Method</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3">Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className={
                "border-t border-brand-400/30 " +
                (row.voided_at ? "text-brand-200 line-through" : "")
              }
            >
              <td className="whitespace-nowrap p-3 tabular-nums">{row.occurred_on}</td>
              <td className="whitespace-nowrap p-3">
                {row.method === "transfer"
                  ? "Bank transfer"
                  : row.method === "card"
                    ? "Card"
                    : "Cash"}
              </td>
              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums">
                {formatUzs(row.amount_uzs)}
              </td>
              <td className="max-w-[12rem] truncate p-3 text-brand-100" title={row.note ?? ""}>
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One line per sub-class: charged so far, the fee in force and the per-student override. */
function GroupFeeRow({
  userId,
  group,
  onSaved,
}: {
  userId: string;
  group: StudentBillingRow;
  onSaved: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const check = checkUzsInput(value, 0n);

  async function save(fee: bigint | null) {
    setBusy(true);
    try {
      await setFeeOverride(userId, group.group_id, fee);
      toast.success(fee == null ? "Back to the group fee" : `Override saved · ${formatUzs(fee)}`);
      setEditing(false);
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the override");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-bold">{group.group_name}</div>
        <div className="truncate text-xs text-brand-100 tabular-nums">
          Activated {group.activated_on ?? "—"} · charged {formatUzs(group.charged_uzs)} (
          {group.charge_count}) · fee{" "}
          {group.monthly_fee_uzs == null ? "not set" : formatUzs(group.monthly_fee_uzs)}
          {group.override_fee_uzs != null && " (student override)"}
        </div>
      </div>
      {editing ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (check.amount != null) void save(check.amount);
          }}
        >
          <MoneyInput
            label="Override (0 = free)"
            value={value}
            onChange={setValue}
            error={check.error}
            className="w-48"
            autoFocus
          />
          <button
            type="submit"
            disabled={busy || check.amount == null}
            className="btn-brand rounded-full bg-brand-400 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            Save
          </button>
          {group.override_fee_uzs != null && (
            <button
              type="button"
              disabled={busy}
              className="tap px-2 py-2 text-xs font-bold"
              onClick={() => void save(null)}
            >
              Use group fee
            </button>
          )}
          <button
            type="button"
            className="tap px-2 py-2 text-xs font-bold"
            onClick={() => setEditing(false)}
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="tap rounded-full bg-brand-500 px-3 py-1.5 text-xs font-bold text-white"
          onClick={() => {
            setValue(group.override_fee_uzs == null ? "" : groupDigits(group.override_fee_uzs));
            setEditing(true);
          }}
        >
          {group.override_fee_uzs == null ? "Set student fee" : "Edit student fee"}
        </button>
      )}
    </li>
  );
}
