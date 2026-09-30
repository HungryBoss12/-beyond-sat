import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Wallet, Receipt, Banknote, CalendarClock } from "lucide-react";
import { StatTile } from "@/components/ui/metric";
import { RankBadge } from "@/components/classes/RankBadge";
import { rankFor, totalScore } from "@/lib/classes/ranking";
import { asInt, type LedgerRow } from "@/lib/billing/types";
import {
  chargeMonth,
  recordPayment,
  setMonthlyFee,
  studentLedger,
  voidEntry,
} from "@/lib/billing/api";
import { formatUzs, parseUzsInput } from "@/lib/billing/money";
import { CLASS_CONTROL } from "./control";
import type { MemberStatus } from "@/lib/classes";

export function StudentMoney({
  userId,
  name,
  status,
  rw,
  math,
  fee,
  onStatus,
}: {
  userId: string;
  name: string;
  status: MemberStatus;
  rw: number;
  math: number;
  fee: number | null;
  onStatus: (status: MemberStatus) => Promise<void>;
}) {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [payOpen, setPayOpen] = useState(false);
  const [feeOpen, setFeeOpen] = useState(false);
  const total = totalScore(rw, math);
  const tier = rankFor(total);
  const live = rows.filter((row) => !row.voided_at);
  const charges = live.filter((row) => row.kind === "charge");
  const payments = live.filter((row) => row.kind === "payment");
  const balance = live.reduce((sum, row) => {
    const amount = asInt(row.amount_uzs);
    return sum + (row.kind === "payment" || row.kind === "discount" ? amount : -amount);
  }, 0);
  const kind = balance < 0 ? "Debt" : balance > 0 ? "Credit" : "Settled";

  async function load() {
    setRows(await studentLedger(userId));
  }

  useEffect(() => {
    void load().catch((err) =>
      toast.error(err instanceof Error ? err.message : "Could not load ledger"),
    );
    // load closes over userId, which is already the dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <RankBadge letter={tier.letter} total={total} size="lg" />
        <select
          className={CLASS_CONTROL + " w-auto"}
          value={status}
          onChange={(e) => void onStatus(e.target.value as MemberStatus)}
        >
          {(["active", "trial", "frozen", "left"] as const).map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white"
          onClick={() => setPayOpen(true)}
        >
          RECORD PAYMENT
        </button>
        <button
          type="button"
          className="tap rounded-full bg-brand-800 px-4 py-2 text-sm font-bold uppercase text-white"
          onClick={() => {
            if (
              status !== "active" &&
              !confirm("This student is not active. Charge this month anyway?")
            )
              return;
            const period = new Date().toISOString().slice(0, 7) + "-01";
            void chargeMonth(userId, period)
              .then(() => {
                toast.success("Charged");
                return load();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Charge failed"));
          }}
        >
          CHARGE THIS MONTH
        </button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile icon={Wallet} label="Current balance" value={Math.abs(balance)} hint={kind} />
        <StatTile
          icon={Receipt}
          label="Total course fees"
          value={charges.reduce((s, r) => s + asInt(r.amount_uzs), 0)}
          hint={`${charges.length} charges`}
        />
        <StatTile
          icon={Banknote}
          label="Total paid"
          value={payments.reduce((s, r) => s + asInt(r.amount_uzs), 0)}
          hint={`${payments.length} payments`}
        />
        <button type="button" className="text-left" onClick={() => setFeeOpen(true)}>
          <StatTile
            icon={CalendarClock}
            label="Monthly fee"
            value={fee ?? 0}
            hint="Auto-charged each month"
          />
        </button>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <LedgerTable
          title="Course fee history"
          rows={charges}
          onVoid={async (id) => {
            const reason = prompt("Void reason");
            if (reason) {
              await voidEntry(id, reason);
              await load();
            }
          }}
        />
        <LedgerTable
          title="Payment history"
          rows={payments}
          onVoid={async (id) => {
            const reason = prompt("Void reason");
            if (reason) {
              await voidEntry(id, reason);
              await load();
            }
          }}
        />
      </div>
      <LedgerTable
        title="Full ledger"
        rows={rows}
        onVoid={async (id) => {
          const reason = prompt("Void reason");
          if (reason) {
            await voidEntry(id, reason);
            await load();
          }
        }}
      />
      <p className="text-xs text-brand-100">
        Recurring course fees are applied automatically for each month since enrollment.
      </p>
      {payOpen && (
        <PayDialog
          debt={balance < 0 ? -balance : (fee ?? 0)}
          onClose={() => setPayOpen(false)}
          onSave={async (amount, method, date, note) => {
            await recordPayment({
              userId,
              amount,
              method,
              occurredOn: date,
              note,
              idempotencyKey: crypto.randomUUID(),
            });
            toast.success("Payment recorded");
            setPayOpen(false);
            await load();
          }}
        />
      )}
      {feeOpen && (
        <FeeDialog
          onClose={() => setFeeOpen(false)}
          onSave={async (amount, from) => {
            await setMonthlyFee(userId, amount, from);
            toast.success("Fee saved");
            setFeeOpen(false);
          }}
        />
      )}
    </div>
  );
}

function LedgerTable({
  title,
  rows,
  onVoid,
}: {
  title: string;
  rows: LedgerRow[];
  onVoid: (id: string) => Promise<void>;
}) {
  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-800 p-3 text-white">
      <h3 className="text-xs font-bold uppercase tracking-wider text-brand-100">{title}</h3>
      <ul className="mt-2 divide-y divide-brand-400/30 text-sm">
        {rows.map((row) => (
          <li
            key={row.id}
            className={
              "flex items-center justify-between gap-2 py-2 " +
              (row.voided_at ? "line-through opacity-60" : "")
            }
          >
            <span>
              {row.occurred_on} · {row.kind} {row.source === "auto" ? "· auto" : ""}
              <span className="block text-xs text-brand-100">{row.note}</span>
            </span>
            <span className="flex items-center gap-2">
              <span className="tabular-nums font-bold">{formatUzs(asInt(row.amount_uzs))}</span>
              {!row.voided_at && (
                <button
                  type="button"
                  className="tap text-xs font-bold"
                  onClick={() => void onVoid(row.id)}
                >
                  Void
                </button>
              )}
            </span>
          </li>
        ))}
        {rows.length === 0 && <li className="py-3 text-brand-100">None yet.</li>}
      </ul>
    </div>
  );
}

function PayDialog({
  debt,
  onClose,
  onSave,
}: {
  debt: number;
  onClose: () => void;
  onSave: (
    amount: number,
    method: "cash" | "card" | "transfer",
    date: string,
    note: string,
  ) => Promise<void>;
}) {
  const [amount, setAmount] = useState(formatUzs(debt).replace(" UZS", ""));
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("Payment");
  const [busy, setBusy] = useState(false);
  const parsed = parseUzsInput(amount);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-900/70 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md space-y-2 rounded-2xl border border-brand-400/40 bg-brand-800 p-5 text-white"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          if (!parsed || parsed < 1000 || parsed > 100_000_000)
            return toast.error("Amount must be between 1 000 and 100 000 000");
          setBusy(true);
          void onSave(parsed, method, date, note).finally(() => setBusy(false));
        }}
      >
        <h3 className="font-black uppercase">RECORD PAYMENT</h3>
        <input
          className={CLASS_CONTROL}
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <select
          className={CLASS_CONTROL}
          value={method}
          onChange={(e) => setMethod(e.target.value as "cash" | "card" | "transfer")}
        >
          <option value="cash">Cash</option>
          <option value="card">Card</option>
          <option value="transfer">Bank transfer</option>
        </select>
        <input
          type="date"
          className={CLASS_CONTROL}
          value={date}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setDate(e.target.value)}
        />
        <input className={CLASS_CONTROL} value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="text-xs text-brand-100">Preview {parsed ? formatUzs(parsed) : "—"}</p>
        <button
          disabled={busy}
          className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white"
        >
          Save
        </button>
      </form>
    </div>
  );
}

function FeeDialog({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (amount: number, from: string) => Promise<void>;
}) {
  const [amount, setAmount] = useState("");
  const [from, setFrom] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-brand-900/70 p-4"
      onClick={onClose}
    >
      <form
        className="w-full max-w-md space-y-2 rounded-2xl border border-brand-400/40 bg-brand-800 p-5 text-white"
        onClick={(event) => event.stopPropagation()}
        onSubmit={(event) => {
          event.preventDefault();
          const parsed = parseUzsInput(amount);
          if (!parsed) return toast.error("Enter a whole-sum fee");
          void onSave(parsed, from);
        }}
      >
        <h3 className="font-black">Monthly fee</h3>
        <input
          className={CLASS_CONTROL}
          placeholder="1 200 000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <input
          type="date"
          className={CLASS_CONTROL}
          value={from}
          onChange={(e) => setFrom(e.target.value)}
        />
        <button className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white">
          SAVE FEE
        </button>
      </form>
    </div>
  );
}
