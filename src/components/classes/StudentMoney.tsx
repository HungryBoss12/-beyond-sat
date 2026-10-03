import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeDollarSign,
  Check,
  CalendarClock,
  CalendarRange,
  HandCoins,
  NotebookPen,
  Receipt,
  ReceiptText,
  Repeat,
  TriangleAlert,
  Wallet,
  Banknote,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { MoneyTile } from "@/components/billing/MoneyTile";
import { RecordPaymentDialog, type PaymentTarget } from "@/components/billing/RecordPaymentDialog";
import { ActivationDateDialog } from "@/components/billing/ActivationDateDialog";
import { TransactionsTable, type TxRow } from "@/components/billing/TransactionsTable";
import { VoidDialog } from "@/components/billing/VoidDialog";
import { KIND_META } from "@/components/billing/meta";
import { chargeThisMonth } from "@/components/billing/charge";
import { FeeDialog } from "@/components/billing/FeeDialog";
import { billingNote, setBillingNote, setStudentFee, studentBilling, studentLedger, voidEntry } from "@/lib/billing/api";
import { listUserAttendance } from "@/lib/classes/groups";
import { periodLabel } from "@/lib/billing/dates";
import { balanceKind, formatUzs } from "@/lib/billing/money";
import type { LedgerRow, StudentBillingRow } from "@/lib/billing/types";

/** Admin-only money block on the student profile (§6). */
export function StudentMoney({ userId, name }: { userId: string; name: string }) {
  const [ledger, setLedger] = useState<LedgerRow[]>([]);
  const [billing, setBilling] = useState<StudentBillingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payFor, setPayFor] = useState<PaymentTarget | null>(null);
  const [activationOpen, setActivationOpen] = useState(false);
  const [voiding, setVoiding] = useState<TxRow | null>(null);
  const [feeOpen, setFeeOpen] = useState(false);
  const [note, setNote] = useState("");
  const [attended, setAttended] = useState<string[]>([]);

  const load = useCallback(async () => {
    try {
      const [rows, groups, savedNote, days] = await Promise.all([
        studentLedger(userId),
        studentBilling(userId),
        billingNote(userId).catch(() => ""),
        listUserAttendance(userId).catch(() => []),
      ]);
      setLedger(rows);
      setBilling(groups);
      setNote(savedNote);
      setAttended(
        days.filter((day) => day.participated).map((day) => day.lesson_date.slice(0, 10)),
      );
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
      ? "No class fee set"
      : joinGroups
          .map((g) => (g.join_total ? `${g.join_remaining}/${g.join_total} lessons` : "Full month"))
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
          icon={BadgeDollarSign}
          label="Set this student's fee"
          variant="outline"
          onClick={() => setFeeOpen(true)}
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

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 stagger">
        <MoneyTile
          icon={Wallet}
          label="Current balance"
          amount={kind === "settled" ? 0n : balance}
          kind={KIND_META[kind].label.toLowerCase()}
          loading={loading}
        />
        <MoneyTile
          icon={TriangleAlert}
          label="Debt"
          amount={balance < 0n ? -balance : 0n}
          hint={balance < 0n ? "Owed" : "Nothing owed"}
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
          hint={priced.length ? "Auto-charged each month" : "No class fee set"}
          loading={loading}
        />
      </div>

      <GroupCharges rows={billing.filter((row) => row.monthly_fee_uzs != null || row.activated_on)} />
      <div className="grid gap-4 lg:grid-cols-2">
        <NoteBox
          note={note}
          onChange={setNote}
          onSave={async () => {
            await setBillingNote(userId, note);
            toast.success("Note saved");
          }}
        />
        <AttendCalendar dates={attended} />
      </div>
      <MoneyChart ledger={live} />

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
      <FeeDialog
        open={feeOpen}
        title="This student's fee"
        description="Replaces the class fee for this student. The first month is still a share of the lessons."
        classes={classChoices(billing)}
        onClose={() => setFeeOpen(false)}
        onSave={async (fee, month, classId) => {
          await setStudentFee(userId, fee, month, classId);
          toast.success("Fee saved");
          await load();
        }}
      />
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

function classChoices(rows: StudentBillingRow[]): { id: string; name: string }[] {
  const map = new Map<string, string[]>();
  for (const row of rows) {
    const names = map.get(row.class_id) ?? [];
    names.push(row.group_name);
    map.set(row.class_id, names);
  }
  return [...map.entries()].map(([id, names]) => ({ id, name: names.join(" · ") }));
}

function GroupCharges({ rows }: { rows: StudentBillingRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border border-brand-400/40 bg-brand-600 text-white">
      <table className="w-full min-w-0 text-left text-sm">
        <thead className="text-[11px] font-bold text-white">
          <tr>
            <th className="p-3">Joined</th>
            <th className="p-3">Group</th>
            <th className="p-3">First month</th>
            <th className="p-3 text-right">Monthly</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.group_id} className="border-t border-brand-400/30">
              <td className="whitespace-nowrap p-3 tabular-nums">{row.activated_on ?? "—"}</td>
              <td className="p-3">{row.group_name}</td>
              <td className="p-3">
                {row.join_amount_uzs == null
                  ? "—"
                  : `${formatUzs(row.join_amount_uzs)}${
                      row.join_total ? ` · ${row.join_remaining}/${row.join_total}` : ""
                    }`}
              </td>
              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums">
                {row.monthly_fee_uzs == null ? "—" : formatUzs(row.monthly_fee_uzs)}
                {row.override_fee_uzs != null ? " · own price" : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NoteBox({
  note,
  onChange,
  onSave,
}: {
  note: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="inline-flex items-center gap-2 text-sm font-black">
          <NotebookPen className="h-4 w-4" aria-hidden="true" />
          Note
        </h3>
        <IconButton icon={Check} label="Save note" variant="brand" onClick={() => void onSave()} />
      </div>
      <textarea
        value={note}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        className="w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white"
      />
    </div>
  );
}

function AttendCalendar({ dates }: { dates: string[] }) {
  const set = new Set(dates);
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1).getDay();
  const days = new Date(year, month + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white">
      <h3 className="mb-2 text-sm font-black">Attended this month</h3>
      <div className="grid grid-cols-7 gap-1 text-center text-xs">
        {cells.map((day, index) => {
          if (!day) return <span key={`e-${index}`} />;
          const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
          const on = set.has(key);
          return (
            <span
              key={key}
              className={
                "grid h-7 place-items-center rounded-md " +
                (on ? "bg-white font-bold text-brand-800" : "text-white")
              }
            >
              {day}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MoneyChart({ ledger }: { ledger: LedgerRow[] }) {
  const months = new Map<string, { charge: bigint; paid: bigint }>();
  for (const row of ledger) {
    const key = (row.period ?? row.occurred_on).slice(0, 7);
    const cur = months.get(key) ?? { charge: 0n, paid: 0n };
    if (row.kind === "charge") cur.charge += row.amount_uzs;
    if (row.kind === "payment") cur.paid += row.amount_uzs;
    months.set(key, cur);
  }
  const bars = [...months.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-6);
  const max = bars.reduce((n, [, v]) => (v.charge > n ? v.charge : v.paid > n ? v.paid : n), 1n);
  if (bars.length === 0) return null;
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white">
      <h3 className="mb-3 text-sm font-black">Charges and payments</h3>
      <div className="flex h-28 items-end gap-3">
        {bars.map(([month, value]) => (
          <div key={month} className="flex flex-1 items-end justify-center gap-1">
            <span
              className="w-3 rounded-t bg-brand-200"
              style={{
                height: value.charge > 0n ? `${Math.max(8, Number((value.charge * 100n) / max))}%` : "0%",
              }}
              title={`Charges ${formatUzs(value.charge)}`}
            />
            <span
              className="w-3 rounded-t bg-white"
              style={{
                height: value.paid > 0n ? `${Math.max(8, Number((value.paid * 100n) / max))}%` : "0%",
              }}
              title={`Payments ${formatUzs(value.paid)}`}
            />
          </div>
        ))}
      </div>
    </div>
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
        <thead className="text-[11px] font-bold text-white">
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
                  <span className="ml-1 text-xs text-white">
                    {row.prorate_lessons}/{row.prorate_total}
                  </span>
                )}
              </td>
              <td className="whitespace-nowrap p-3 text-right font-bold tabular-nums">
                {formatUzs(row.amount_uzs)}
              </td>
              <td className="max-w-[12rem] truncate p-3 text-white" title={row.note ?? ""}>
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
        <thead className="text-[11px] font-bold text-white">
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
              <td className="max-w-[12rem] truncate p-3 text-white" title={row.note ?? ""}>
                {row.note}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

