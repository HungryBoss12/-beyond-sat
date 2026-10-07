import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { listAllClasses } from "@/lib/classes/api";
import {
  addGroupMember,
  listGroups,
  removeGroupMember,
  type ClassGroup,
} from "@/lib/classes/groups";
import type { ClassRow } from "@/lib/classes/types";
import { studentBilling } from "@/lib/billing/api";

function groupLabel(group: ClassGroup): string {
  if (/\b(eng|english|maths|math)\b/i.test(group.name)) return group.name;
  return `${group.name} · ${group.subject === "math" ? "Math" : "Eng"}`;
}

/** Add or remove the groups a student attends, from their profile. */
export function EditGroupsDialog({
  open,
  userId,
  name,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [current, setCurrent] = useState<string[]>([]);
  const [classId, setClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setClassId("");
    void Promise.all([listAllClasses(), listGroups(), studentBilling(userId)])
      .then(([classRows, groupRows, billing]) => {
        setClasses(classRows);
        setGroups(groupRows);
        setCurrent(billing.filter((row) => row.status !== "left").map((row) => row.group_id));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load groups"));
  }, [open, userId]);

  const chosen = groups.filter((group) => current.includes(group.id));
  const classGroups = groups.filter((group) => group.class_id === classId && group.active);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const billing = await studentBilling(userId);
      const before = new Set(billing.filter((row) => row.status !== "left").map((row) => row.group_id));
      const after = new Set(current);
      const toAdd = [...after].filter((id) => !before.has(id));
      const toRemove = [...before].filter((id) => !after.has(id));
      for (const id of toAdd) {
        await addGroupMember({ groupId: id, userId, status: "active" });
      }
      const removed: string[] = [];
      try {
        for (const id of toRemove) {
          await removeGroupMember(id, userId);
          removed.push(id);
        }
      } catch (removeErr) {
        for (const id of removed) {
          await addGroupMember({ groupId: id, userId, status: "active" }).catch(() => undefined);
        }
        throw removeErr;
      }
      toast.success("Groups updated");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save groups");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-w-md border-brand-400/40 bg-brand-600 text-white shadow-none sm:rounded-2xl [&>button]:!bg-transparent [&>button]:!text-white">
        <DialogHeader className="space-y-0 text-left">
          <DialogTitle className="text-lg font-black text-white">Groups for {name}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-brand-100">
          The two earliest groups are the ones that count toward the monthly fee.
        </p>
        {error && <p className="text-xs font-semibold text-white">{error}</p>}
        <ul className="space-y-1">
          {chosen.map((group) => (
            <li key={group.id} className="flex items-center justify-between gap-2 rounded-lg bg-brand-800 px-3 py-2">
              <span className="text-sm font-bold">{groupLabel(group)}</span>
              <button
                type="button"
                className="text-xs font-bold text-brand-100 hover:text-white"
                onClick={() => setCurrent((ids) => ids.filter((id) => id !== group.id))}
              >
                Remove
              </button>
            </li>
          ))}
          {chosen.length === 0 && <li className="text-xs text-brand-100">Not in a group yet.</li>}
        </ul>
        <div className="flex flex-wrap gap-1.5">
          {classes.filter((klass) => klass.active).map((klass) => (
            <button
              key={klass.id}
              type="button"
              onClick={() => setClassId(klass.id)}
              className={
                "rounded-full px-3 py-1.5 text-xs font-bold transition duration-150 " +
                (classId === klass.id ? "bg-brand-400 text-white" : "bg-brand-800 text-white hover:bg-brand-900")
              }
            >
              {klass.name}
            </button>
          ))}
        </div>
        {classId && (
          <ul className="space-y-1">
            {classGroups.map((group) => (
              <li key={group.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-brand-800">
                  <input
                    type="checkbox"
                    checked={current.includes(group.id)}
                    onChange={() =>
                      setCurrent((ids) =>
                        ids.includes(group.id) ? ids.filter((id) => id !== group.id) : [...ids, group.id],
                      )
                    }
                    className="h-4 w-4 rounded border-brand-400 bg-brand-800"
                  />
                  {groupLabel(group)}
                </label>
              </li>
            ))}
          </ul>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={() => void save()}
            className="rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {busy ? "Saving…" : "Save groups"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
