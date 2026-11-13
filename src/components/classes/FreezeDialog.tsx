import { useEffect, useState } from "react";
import { Snowflake, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DateTimeField } from "@/components/ui/date-time-field";
import { tashkentToday } from "@/lib/billing/dates";
import { freezeGroupMembers } from "@/lib/classes/groups";
import { shortDate } from "@/lib/classes/schedule";

export type FreezeTarget = {
  userId: string;
  name: string;
  frozenOn?: string | null;
  resumesOn?: string | null;
};

/** The day after a YYYY-MM-DD date. That day is the first day back after an inclusive end. */
function dayAfter(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day));
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}

/** Freeze every listed sub-class with the same window. */
export function FreezeDialog({
  person,
  groupIds,
  onClose,
  onSaved,
}: {
  person: FreezeTarget | null;
  groupIds: string[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
}) {
  const [past, setPast] = useState(false);
  const [started, setStarted] = useState(() => tashkentToday());
  const [resumes, setResumes] = useState("");
  const [ended, setEnded] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!person) return;
    setPast(false);
    setStarted(person.frozenOn || tashkentToday());
    setResumes(person.resumesOn || "");
    setEnded("");
    setReason("");
  }, [person]);

  async function save() {
    if (!person || !started || groupIds.length === 0) return;
    const today = tashkentToday();
    let back: string | null = resumes || null;
    let why: string | null = null;
    if (past) {
      why = reason.trim();
      if (!ended) {
        toast.error("Choose the last day of the freeze");
        return;
      }
      if (ended < started) {
        toast.error("The end must be on or after the start");
        return;
      }
      if (ended >= today) {
        toast.error("A past freeze must end before today");
        return;
      }
      if (!why || why.length > 200) {
        toast.error(why ? "The reason must be 200 characters or fewer" : "Write a reason for this freeze");
        return;
      }
      back = dayAfter(ended);
    } else if (resumes && resumes <= started) {
      toast.error("Activation date must be after the freeze start");
      return;
    } else if (resumes && resumes <= today) {
      toast.error('Use "Correct a past period" when the freeze has already ended');
      return;
    }
    setBusy(true);
    try {
      await freezeGroupMembers(groupIds, person.userId, started, back, why);
      toast.success(
        past
          ? `${person.name} was frozen ${shortDate(started)}–${shortDate(ended)}. The fee for that period was recalculated.`
          : back
            ? `${person.name} is frozen from ${shortDate(started)} until ${shortDate(back)}`
            : `${person.name} is frozen from ${shortDate(started)}`,
      );
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not freeze the student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!person} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Freeze {person?.name}</DialogTitle>
          <DialogDescription className="text-white">
            {past
              ? "Both dates are days the student did not come. They stay active now, and the fee for that period is recalculated."
              : "The fee stops on the start date. Leave the activation date empty to keep the freeze until someone activates them by hand."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-pressed={!past}
            className={
              past
                ? "rounded-full px-3 py-2 text-sm font-bold text-white ring-1 ring-white/30"
                : "rounded-full bg-brand-400 px-3 py-2 text-sm font-bold text-white"
            }
            onClick={() => setPast(false)}
          >
            Freeze from a date
          </button>
          <button
            type="button"
            aria-pressed={past}
            className={
              past
                ? "rounded-full bg-brand-400 px-3 py-2 text-sm font-bold text-white"
                : "rounded-full px-3 py-2 text-sm font-bold text-white ring-1 ring-white/30"
            }
            onClick={() => setPast(true)}
          >
            Correct a past period
          </button>
        </div>
        <div>
          <div className="text-xs font-bold text-white">{past ? "First day frozen" : "Freeze started"}</div>
          <div className="mt-1">
            <DateTimeField dateOnly value={started} onChange={setStarted} />
          </div>
        </div>
        {past ? (
          <>
            <div>
              <div className="text-xs font-bold text-white">Last day frozen</div>
              <div className="mt-1">
                <DateTimeField dateOnly value={ended} onChange={setEnded} />
              </div>
            </div>
            <label className="block">
              <span className="text-xs font-bold text-white">Reason</span>
              <textarea
                value={reason}
                maxLength={200}
                rows={3}
                onChange={(event) => setReason(event.target.value)}
                placeholder="They did not come these days"
                className="mt-1 w-full resize-none rounded-xl border border-white/30 bg-brand-900 px-3 py-2 text-sm text-white placeholder:text-white/50"
              />
            </label>
          </>
        ) : (
          <div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-white">Activates on</div>
              <button
                type="button"
                className="text-xs font-bold text-brand-100 underline-offset-2 hover:underline"
                onClick={() => setResumes("")}
              >
                Skip
              </button>
            </div>
            <div className="mt-1">
              <DateTimeField dateOnly value={resumes} onChange={setResumes} />
            </div>
          </div>
        )}
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={busy || !started || groupIds.length === 0}
            className="rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            onClick={() => void save()}
          >
            <Snowflake className="mr-1 inline h-4 w-4" aria-hidden="true" />
            Freeze payments
          </button>
          <button type="button" className="tap px-4 py-2 text-sm font-bold" disabled={busy} onClick={onClose}>
            <X className="mr-1 inline h-4 w-4" aria-hidden="true" /> Cancel
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
