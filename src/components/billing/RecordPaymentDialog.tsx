import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { CLASS_CONTROL } from "@/components/classes/control";
import { billingLimits, recordPayment } from "@/lib/billing/api";
import { tashkentToday } from "@/lib/billing/dates";
import {
  UZS_CONFIRM_OVER,
  UZS_DEFAULT_MAX_PAYMENT,
  UZS_MIN_PAYMENT,
  absUzs,
  balanceKind,
  checkUzsInput,
  formatUzs,
  groupDigits,
  needsPaymentConfirm,
} from "@/lib/billing/money";
import { PAY_METHOD_LABEL, type BillingLimits, type PayMethod } from "@/lib/billing/types";

let limitsRequest: Promise<BillingLimits> | null = null;

function loadLimits(): Promise<BillingLimits> {
  limitsRequest ??= billingLimits().catch((err) => {
    limitsRequest = null;
    throw err;
  });
  return limitsRequest;
}

const KIND_WORD = { debt: "Debt", credit: "Credit", settled: "Settled" } as const;

export type PaymentTarget = {
  userId: string;
  name: string;
  balance: bigint;
  monthlyFee: bigint | null;
};

export function RecordPaymentDialog({
  target,
  onClose,
  onSaved,
}: {
  target: PaymentTarget | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [limits, setLimits] = useState<BillingLimits>({
    min_payment_uzs: UZS_MIN_PAYMENT,
    max_payment_uzs: UZS_DEFAULT_MAX_PAYMENT,
    confirm_over_uzs: UZS_CONFIRM_OVER,
  });
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PayMethod>("cash");
  const [date, setDate] = useState(tashkentToday());
  const [note, setNote] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  // One key per opening, so a double-click or retry cannot record the payment twice.
  const idempotencyKey = useMemo(() => (target ? crypto.randomUUID() : ""), [target]);

  useEffect(() => {
    void loadLimits()
      .then(setLimits)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!target) return;
    const prefill = target.balance < 0n ? absUzs(target.balance) : (target.monthlyFee ?? 0n);
    setAmount(prefill > 0n ? groupDigits(prefill) : "");
    setMethod("cash");
    setDate(tashkentToday());
    setNote("");
    setConfirming(false);
  }, [target]);

  if (!target) return null;
  const today = tashkentToday();
  const check = checkUzsInput(amount, limits.min_payment_uzs, limits.max_payment_uzs);
  const kind = balanceKind(target.balance);
  const after = check.amount == null ? null : target.balance + check.amount;
  const dateError = date > today ? "The date cannot be in the future" : null;
  const canSave = check.amount != null && !dateError && !busy;

  async function save() {
    if (check.amount == null || !target) return;
    setBusy(true);
    try {
      await recordPayment({
        userId: target.userId,
        amount: check.amount,
        method,
        occurredOn: date,
        note: note.trim() || "Payment",
        idempotencyKey,
      });
      toast.success(`Payment recorded · ${target.name} · ${formatUzs(check.amount)}`);
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not record the payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Record payment</DialogTitle>
          <DialogDescription className="min-w-0 truncate tabular-nums text-white">
            {target.name} · {KIND_WORD[kind]}
            {kind === "settled" ? "" : ` ${formatUzs(target.balance)}`}
          </DialogDescription>
        </DialogHeader>

        {confirming && check.amount != null ? (
          <div className="space-y-4">
            <p className="text-sm text-white">
              This is a large payment. Check the digits before saving.
            </p>
            <p className="break-all rounded-xl bg-brand-600 p-4 text-center text-2xl font-black tabular-nums">
              {formatUzs(check.amount)}
            </p>
            <p className="text-center text-xs text-white tabular-nums">
              {check.amount.toString()} UZS · {PAY_METHOD_LABEL[method]} · {date}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="tap px-4 py-2 text-sm font-bold"
                onClick={() => setConfirming(false)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => void save()}
              >
                Confirm and save
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (!canSave || check.amount == null) return;
              if (needsPaymentConfirm(check.amount, target.balance, limits.confirm_over_uzs)) {
                setConfirming(true);
                return;
              }
              void save();
            }}
          >
            <MoneyInput
              autoFocus
              label="Amount (UZS)"
              value={amount}
              onChange={setAmount}
              error={check.error}
              hint={`${groupDigits(limits.min_payment_uzs)} – ${groupDigits(limits.max_payment_uzs)} UZS`}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-bold text-white">
                Method
                <select
                  className={CLASS_CONTROL + " mt-1"}
                  value={method}
                  onChange={(e) => setMethod(e.target.value as PayMethod)}
                >
                  {(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((item) => (
                    <option key={item} value={item}>
                      {PAY_METHOD_LABEL[item]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-white">
                Date
                <input
                  type="date"
                  max={today}
                  className={CLASS_CONTROL + " mt-1"}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
                {dateError && <span className="mt-1 block text-white">{dateError}</span>}
              </label>
            </div>
            <label className="block text-xs font-bold text-white">
              Note (optional)
              <input
                maxLength={80}
                placeholder="September fee, partial…"
                className={CLASS_CONTROL + " mt-1"}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <p className="min-w-0 truncate text-xs text-white tabular-nums">
              Balance after:{" "}
              {after == null
                ? "—"
                : `${KIND_WORD[balanceKind(after)]}${after === 0n ? "" : ` ${formatUzs(after)}`}`}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
