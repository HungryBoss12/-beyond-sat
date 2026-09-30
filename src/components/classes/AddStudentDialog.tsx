import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  addClassMember,
  displayName,
  listAllClasses,
  listUsersForAdmin,
  searchUsersForAdmin,
  type ChatProfile,
  type ClassRow,
} from "@/lib/classes";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { setMonthlyFee, applyRecurringFees } from "@/lib/billing/api";
import { parseUzsInput } from "@/lib/billing/money";
import { createClassStudent } from "@/lib/auth/create-user";
import { CLASS_CONTROL } from "./control";

export function AddStudentDialog({
  classId,
  open,
  isAdmin,
  onClose,
  onAdded,
}: {
  classId: string;
  open: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<ChatProfile[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"active" | "trial">("active");
  const [enrolledOn, setEnrolledOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [fee, setFee] = useState("");
  const [busy, setBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");

  useEffect(() => {
    if (!open) return;
    void listAllClasses()
      .then(setClasses)
      .catch(() => {});
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handle = window.setTimeout(() => {
      setLoading(true);
      const request =
        query.trim().length < 2 ? listUsersForAdmin({ limit: 50 }) : searchUsersForAdmin(query, 30);
      void request
        .then(setRows)
        .catch(() => setRows([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  function className(id: string | null) {
    return classes.find((row) => row.id === id)?.name ?? null;
  }

  async function confirmAdd() {
    if (!selected.size) return;
    setBusy(true);
    let added = 0;
    try {
      for (const id of selected) {
        const person = rows.find((row) => row.id === id);
        const other =
          person?.class_id && person.class_id !== classId ? className(person.class_id) : null;
        if (other && !confirm(`Move from ${other}?`)) continue;
        await addClassMember(classId, id, { status, enrolledOn });
        if (isAdmin && fee.trim()) {
          const amount = parseUzsInput(fee);
          if (amount) {
            await setMonthlyFee(id, amount, enrolledOn);
            await applyRecurringFees();
          }
        }
        added += 1;
      }
      if (added === 0) {
        toast.message("No students were added");
        return;
      }
      toast.success(`Added ${added} student${added === 1 ? "" : "s"}`);
      setSelected(new Set());
      await onAdded();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add students");
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    setBusy(true);
    try {
      await createClassStudent({ name: createName, password: createPassword, classId });
      toast.success("Student created");
      setCreateName("");
      setCreatePassword("");
      await onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="uppercase text-white">ADD STUDENT</DialogTitle>
        </DialogHeader>
        <input
          autoFocus
          className={CLASS_CONTROL}
          placeholder="Name, username, email, or phone"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {loading && <Loader2 className="mt-3 h-4 w-4 animate-spin" />}
        <ul className="mt-3 max-h-64 divide-y divide-brand-400/30 overflow-y-auto">
          {rows.map((row) => {
            const here = row.class_id === classId;
            const other = row.class_id && !here ? className(row.class_id) : null;
            const subtitle = isOnline(row.last_seen_at)
              ? "online"
              : `last seen ${lastSeenLabel(row.last_seen_at)}`;
            return (
              <li key={row.id} className="flex items-center gap-2 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold">{displayName(row)}</div>
                  <div className="truncate text-[11px] text-brand-100">
                    {subtitle}
                    {here
                      ? " · Already in this class"
                      : other
                        ? ` · in ${other}`
                        : " · not in a class"}
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={here}
                  checked={selected.has(row.id)}
                  onChange={() => {
                    setSelected((cur) => {
                      const next = new Set(cur);
                      if (next.has(row.id)) next.delete(row.id);
                      else next.add(row.id);
                      return next;
                    });
                  }}
                />
              </li>
            );
          })}
          {query.trim().length >= 2 && !loading && rows.length === 0 && (
            <li className="py-4 text-sm text-brand-100">No students match</li>
          )}
        </ul>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <select
            className={CLASS_CONTROL}
            value={status}
            onChange={(e) => setStatus(e.target.value as "active" | "trial")}
          >
            <option value="active">Active</option>
            <option value="trial">Trial</option>
          </select>
          <input
            type="date"
            className={CLASS_CONTROL}
            value={enrolledOn}
            onChange={(e) => setEnrolledOn(e.target.value)}
          />
          {isAdmin && (
            <input
              className={CLASS_CONTROL + " sm:col-span-2"}
              placeholder="Monthly fee (optional)"
              value={fee}
              onChange={(e) => setFee(e.target.value)}
            />
          )}
        </div>
        <button
          type="button"
          disabled={busy || selected.size === 0}
          onClick={() => void confirmAdd()}
          className="btn-brand mt-3 rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
        >
          Add {selected.size} students
        </button>
        <div className="mt-4 border-t border-brand-400/30 pt-3">
          <p className="text-xs font-bold uppercase text-brand-100">Create new student</p>
          <input
            className={CLASS_CONTROL + " mt-2"}
            placeholder="Name"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
          />
          <input
            className={CLASS_CONTROL + " mt-2"}
            placeholder="Password"
            type="password"
            value={createPassword}
            onChange={(e) => setCreatePassword(e.target.value)}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void createNew()}
            className="tap mt-2 text-sm font-bold text-brand-100"
          >
            Create account
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
