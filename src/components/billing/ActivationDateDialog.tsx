import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASS_CONTROL } from "@/components/classes/control";
import { previewActivationChange, setActivationDate } from "@/lib/billing/api";
import { periodLabel } from "@/lib/billing/dates";
import { formatUzs } from "@/lib/billing/money";
import type { ActivationPreviewRow } from "@/lib/billing/types";

export type ActivationGroup = {
  groupId: string;
  groupName: string;
  activatedOn: string | null;
};

type Pending = { group: ActivationGroup; date: string; voids: ActivationPreviewRow[] };

/**
 * One billing-start date per sub-class. Changing it voids the auto charges it
 * makes wrong (listed first for confirmation) and re-applies; manual rows stay.
 */
export function ActivationDateDialog({
  open,
  userId,
  name,
  groups,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  name: string;
  groups: ActivationGroup[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [dates, setDates] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<Pending[] | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDates(Object.fromEntries(groups.map((g) => [g.groupId, g.activatedOn ?? ""])));
    setPending(null);
  }, [open, groups]);

  const changed = groups.filter((g) => dates[g.groupId] && dates[g.groupId] !== g.activatedOn);

  async function review() {
    setBusy(true);
    try {
      const rows: Pending[] = [];
      for (const group of changed) {
        const date = dates[group.groupId]!;
        rows.push({
          group,
          date,
          voids: await previewActivationChange(userId, group.groupId, date),
        });
      }
      setPending(rows);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not check the charges");
    } finally {
      setBusy(false);
    }
  }

  async function apply() {
    if (!pending) return;
    setBusy(true);
    try {
      let voided = 0;
      for (const row of pending)
        voided += await setActivationDate(userId, row.group.groupId, row.date);
      toast.success(
        voided
          ? `Activation saved · ${voided} charge(s) voided and re-applied`
          : "Activation saved",
      );
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the activation date");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Activation date</DialogTitle>
          <DialogDescription className="text-brand-100">
            {name} · billing starts on this day. The join month is prorated by remaining lessons.
          </DialogDescription>
        </DialogHeader>
        {pending ? (
          <div className="space-y-3">
            {pending.map((row) => (
              <div key={row.group.groupId} className="rounded-xl bg-brand-600 p-3 text-sm">
                <p className="font-bold">
                  {row.group.groupName}: {row.group.activatedOn ?? "not set"} → {row.date}
                </p>
                {row.voids.length === 0 ? (
                  <p className="mt-1 text-xs text-brand-100">No charges will be voided.</p>
                ) : (
                  <ul className="mt-1 space-y-0.5 text-xs text-brand-100">
                    {row.voids.map((v) => (
                      <li key={v.id} className="flex justify-between gap-2 tabular-nums">
                        <span className="truncate">Void {periodLabel(v.period)}</span>
                        <span className="shrink-0">{formatUzs(v.amount_uzs)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
            <p className="text-xs text-brand-100">Manual charges and payments are never touched.</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="tap px-4 py-2 text-sm font-bold"
                onClick={() => setPending(null)}
              >
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                onClick={() => void apply()}
              >
                Void and re-apply
              </button>
            </div>
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              if (changed.length) void review();
            }}
          >
            {groups.length === 0 && (
              <p className="text-sm text-brand-100">This student is not in a sub-class.</p>
            )}
            {groups.map((group) => (
              <label key={group.groupId} className="block text-xs font-bold text-brand-100">
                {group.groupName}
                <input
                  type="date"
                  className={CLASS_CONTROL + " mt-1"}
                  value={dates[group.groupId] ?? ""}
                  onChange={(e) => setDates((cur) => ({ ...cur, [group.groupId]: e.target.value }))}
                />
              </label>
            ))}
            <div className="flex justify-end gap-2">
              <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || changed.length === 0}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Review changes
              </button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
