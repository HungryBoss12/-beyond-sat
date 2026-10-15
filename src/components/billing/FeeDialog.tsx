import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconButton } from "@/components/ui/icon-button";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { DateTimeField } from "@/components/ui/date-time-field";
import { periodLabel, tashkentToday } from "@/lib/billing/dates";
import { checkUzsInput } from "@/lib/billing/money";
import { cn } from "@/lib/utils";

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const next = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return next.toISOString().slice(0, 7);
}

export function FeeDialog({
  open,
  title,
  description,
  classes,
  onClose,
  onSave,
}: {
  open: boolean;
  title: string;
  description: string;
  /** When set, the admin picks one class or every class. */
  classes?: { id: string; name: string }[];
  onClose: () => void;
  onSave: (fee: bigint, month: string, classId: string | null) => Promise<void>;
}) {
  const todayMonth = tashkentToday().slice(0, 7);
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(todayMonth);
  const [classId, setClassId] = useState("all");
  const [busy, setBusy] = useState(false);
  const check = checkUzsInput(amount, 1000n, 100_000_000n);
  const shortcuts = [
    { id: shiftMonth(todayMonth, -1), label: "Last month" },
    { id: todayMonth, label: "This month" },
    { id: shiftMonth(todayMonth, 1), label: "Next month" },
    { id: shiftMonth(todayMonth, 2), label: "In two months" },
  ];

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMonth(todayMonth);
    setClassId("all");
  }, [open, todayMonth]);

  async function save() {
    if (!check.amount) {
      toast.error(check.error ?? "Enter a fee");
      return;
    }
    setBusy(true);
    try {
      await onSave(check.amount, `${month}-01`, classes ? (classId === "all" ? null : classId) : null);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the fee");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-brand-400/40 bg-brand-600 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-brand-100">{description}</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <MoneyInput value={amount} onChange={setAmount} label="Monthly fee" />
          <div>
            <div className="text-xs font-bold text-white">Starts</div>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {shortcuts.map((choice) => (
                <button
                  key={choice.id}
                  type="button"
                  aria-pressed={month === choice.id}
                  onClick={() => setMonth(choice.id)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-xs font-bold transition-colors duration-200",
                    month === choice.id ? "bg-brand-400 text-white" : "bg-brand-800 text-white",
                  )}
                >
                  {choice.label}
                </button>
              ))}
            </div>
            <div className="mt-2">
              <DateTimeField
                dateOnly
                value={`${month}-01`}
                onChange={(iso) => setMonth(iso.slice(0, 7))}
              />
            </div>
            <p className="mt-1 text-xs text-brand-100">
              {periodLabel(`${month}-01`)}. The first month is still a share of that month’s lessons.
            </p>
          </div>
          {classes ? (
            <AdminSelect
              label="Applies to"
              value={classId}
              onValueChange={setClassId}
              options={[
                { value: "all", label: "Every class" },
                ...classes.map((row) => ({ value: row.id, label: row.name })),
              ]}
            />
          ) : null}
          {check.error ? <p className="text-xs font-semibold text-white">{check.error}</p> : null}
          <div className="flex justify-end">
            <IconButton icon={Check} label="Save fee" variant="brand" disabled={busy} onClick={() => void save()} />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
