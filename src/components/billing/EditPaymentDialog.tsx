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
import { AdminSelect } from "@/components/admin/AdminSelect";
import { DateTimeField } from "@/components/ui/date-time-field";
import { CLASS_CONTROL } from "@/components/classes/control";
import { billingLimits, editPayment } from "@/lib/billing/api";
import { tashkentToday } from "@/lib/billing/dates";
import {
  UZS_CONFIRM_OVER,
  UZS_DEFAULT_MAX_PAYMENT,
  UZS_MIN_PAYMENT,
  checkUzsInput,
  formatUzs,
  groupDigits,
  needsPaymentConfirm,
} from "@/lib/billing/money";
import { PAY_METHOD_LABEL, type BillingLimits, type LedgerRow, type PayMethod } from "@/lib/billing/types";

let limitsRequest: Promise<BillingLimits> | null = null;

function loadLimits(): Promise<BillingLimits> {
  limitsRequest ??= billingLimits().catch((err) => {
    limitsRequest = null;
    throw err;
  });
  return limitsRequest;
}

/** Corrects a recorded payment. The old row is voided and a new one is written. */
export function EditPaymentDialog({
  row,
  onClose,
  onSaved,
}: {
  row: LedgerRow | null;
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

  useEffect(() => {
    void loadLimits()
      .then(setLimits)
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!row) return;
    setAmount(groupDigits(row.amount_uzs));
    setMethod(row.method ?? "cash");
    setDate(row.occurred_on.slice(0, 10));
    setNote(row.note ?? "");
    setConfirming(false);
  }, [row]);

  const today = tashkentToday();
  const check = useMemo(
    () => checkUzsInput(amount, limits.min_payment_uzs, limits.max_payment_uzs),
    [amount, limits],
  );
  const dateError = date > today ? "The date cannot be in the future" : null;
  const canSave = check.amount != null && !dateError && !busy;

  if (!row) return null;

  async function save() {
    if (check.amount == null || !row) return;
    setBusy(true);
    try {
      await editPayment({
        id: row.id,
        amount: check.amount,
        method,
        occurredOn: date,
        note: note.trim() || "Payment",
      });
      toast.success(`Payment updated · ${formatUzs(check.amount)}`);
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the payment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Edit payment</DialogTitle>
          <DialogDescription className="text-white">
            The original payment stays in the ledger as voided.
          </DialogDescription>
        </DialogHeader>
        {confirming && check.amount != null ? (
          <div className="space-y-4">
            <p className="text-sm text-white">This is a large payment. Check the digits before saving.</p>
            <p className="break-all rounded-xl bg-brand-600 p-4 text-center text-2xl font-black tabular-nums">
              {formatUzs(check.amount)}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={() => setConfirming(false)}>
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
              if (needsPaymentConfirm(check.amount, 0n, limits.confirm_over_uzs)) {
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
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <AdminSelect
                label="Method"
                value={method}
                onValueChange={(value) => setMethod(value as PayMethod)}
                options={(Object.keys(PAY_METHOD_LABEL) as PayMethod[]).map((item) => ({
                  value: item,
                  label: PAY_METHOD_LABEL[item],
                }))}
              />
              <div>
                <div className="mb-1 text-xs font-bold text-white">Date</div>
                <DateTimeField dateOnly value={date} onChange={setDate} />
              </div>
            </div>
            {dateError && <p className="text-xs font-bold text-white">{dateError}</p>}
            <label className="block text-xs font-bold text-white">
              Note
              <input
                className={CLASS_CONTROL + " mt-1"}
                value={note}
                maxLength={80}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={!canSave}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                {busy ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
