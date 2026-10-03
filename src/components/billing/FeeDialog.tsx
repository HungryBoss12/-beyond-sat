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
import { CLASS_CONTROL } from "@/components/classes/control";
import { tashkentToday } from "@/lib/billing/dates";
import { checkUzsInput } from "@/lib/billing/money";

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
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState(() => tashkentToday().slice(0, 7));
  const [classId, setClassId] = useState("all");
  const [busy, setBusy] = useState(false);
  const check = checkUzsInput(amount, 1000n, 100_000_000n);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMonth(tashkentToday().slice(0, 7));
    setClassId("all");
  }, [open]);

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
          <label className="block text-xs font-bold text-white">
            Starts
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className={CLASS_CONTROL + " mt-1"}
            />
          </label>
          {classes ? (
            <label className="block text-xs font-bold text-white">
              Applies to
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                className={CLASS_CONTROL + " mt-1"}
              >
                <option value="all">Every class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
            </label>
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
