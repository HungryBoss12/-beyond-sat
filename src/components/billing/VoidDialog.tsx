import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CLASS_CONTROL } from "@/components/classes/control";

/** Asks for the reason before voiding a ledger row or level score. */
export function VoidDialog({
  open,
  title,
  description,
  onClose,
  onVoid,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onVoid: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setReason("");
          onClose();
        }
      }}
    >
      <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">{title}</DialogTitle>
          <DialogDescription className="text-brand-100">{description}</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reason.trim()) return;
            setBusy(true);
            void onVoid(reason.trim())
              .then(() => {
                setReason("");
                onClose();
              })
              .catch((err) => toast.error(err instanceof Error ? err.message : "Could not void"))
              .finally(() => setBusy(false));
          }}
        >
          <label className="block text-xs font-bold text-brand-100">
            Reason (required)
            <input
              autoFocus
              maxLength={120}
              className={CLASS_CONTROL + " mt-1"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2">
            <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !reason.trim()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Void
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
