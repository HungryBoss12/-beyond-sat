import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyInput } from "@/components/billing/MoneyInput";
import { SubclassChip } from "@/components/classes/SubclassChip";
import { CLASS_CONTROL } from "@/components/classes/control";
import { deleteClass, updateClass, type ClassRow } from "@/lib/classes";
import { DAY_LABELS } from "@/lib/classes/classroom";
import {
  listStaff,
  personName,
  updateGroup,
  type ClassGroup,
  type PersonProfile,
} from "@/lib/classes/groups";
import { groupFees, setGroupFee } from "@/lib/billing/api";
import { monthStart, tashkentToday } from "@/lib/billing/dates";
import { checkUzsInput, groupDigits } from "@/lib/billing/money";

type GroupDraft = {
  name: string;
  teacher_id: string;
  days: number[];
  start: string;
  end: string;
  room: string;
  level: string;
  active: boolean;
  fee: string;
  savedFee: string;
};

function draftFor(group: ClassGroup): GroupDraft {
  return {
    name: group.name,
    teacher_id: group.teacher_id ?? "",
    days: group.schedule_days ?? [],
    start: group.start_time?.slice(0, 5) ?? "",
    end: group.end_time?.slice(0, 5) ?? "",
    room: group.room ?? "",
    level: group.level ?? "",
    active: group.active,
    fee: "",
    savedFee: "",
  };
}

/** Edit the parent and both sub-classes in one place. Fees are admin-only. */
export function ClassEditDialog({
  open,
  klass,
  groups,
  isAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  open: boolean;
  klass: ClassRow;
  groups: ClassGroup[];
  isAdmin: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(klass.name);
  const [description, setDescription] = useState(klass.description ?? "");
  const [active, setActive] = useState(klass.active);
  const [drafts, setDrafts] = useState<Record<string, GroupDraft>>({});
  const [staff, setStaff] = useState<PersonProfile[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(klass.name);
    setDescription(klass.description ?? "");
    setActive(klass.active);
    const next = Object.fromEntries(groups.map((g) => [g.id, draftFor(g)]));
    setDrafts(next);
    if (isAdmin) {
      void listStaff().then(setStaff);
      void groupFees()
        .then((rows) => {
          setDrafts((cur) => {
            const copy = { ...cur };
            for (const row of rows) {
              const draft = copy[row.group_id];
              if (!draft) continue;
              const text = row.monthly_fee_uzs == null ? "" : groupDigits(row.monthly_fee_uzs);
              copy[row.group_id] = { ...draft, fee: text, savedFee: text };
            }
            return copy;
          });
        })
        .catch(() => {});
    }
  }, [open, klass, groups, isAdmin]);

  function patch(groupId: string, next: Partial<GroupDraft>) {
    setDrafts((cur) => ({ ...cur, [groupId]: { ...cur[groupId]!, ...next } }));
  }

  const feeErrors = Object.fromEntries(
    Object.entries(drafts).map(([id, d]) => [id, checkUzsInput(d.fee, 1000n, 100_000_000n)]),
  );
  const invalid = Object.values(feeErrors).some((c) => c.error);

  async function save() {
    if (!name.trim()) return toast.error("Name the class");
    setBusy(true);
    try {
      await updateClass(klass.id, {
        name: name.trim(),
        description: description.trim() || null,
        active,
      });
      for (const group of groups) {
        const d = drafts[group.id];
        if (!d) continue;
        await updateGroup(group.id, {
          name: d.name.trim() || group.name,
          ...(isAdmin ? { teacher_id: d.teacher_id || null } : {}),
          schedule_days: d.days.length ? [...d.days].sort((a, b) => a - b) : null,
          start_time: d.start || null,
          end_time: d.end || null,
          room: d.room.trim() || null,
          level: d.level.trim() || null,
          active: d.active,
        });
        if (isAdmin && d.fee !== d.savedFee) {
          await setGroupFee(
            group.id,
            feeErrors[group.id]?.amount ?? null,
            monthStart(tashkentToday()),
          );
        }
      }
      toast.success("Class saved");
      onClose();
      await onSaved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the class");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Edit class</DialogTitle>
          <DialogDescription className="text-brand-100">
            A parent class always has one Maths (AFL) and one Eng (VAR) sub-class.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!invalid) void save();
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-xs font-bold text-brand-100">
              Class name
              <input
                className={CLASS_CONTROL + " mt-1"}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label className="block text-xs font-bold text-brand-100">
              Description
              <input
                className={CLASS_CONTROL + " mt-1"}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active
            </label>
          </div>

          {groups.map((group) => {
            const d = drafts[group.id];
            if (!d) return null;
            return (
              <fieldset
                key={group.id}
                className="space-y-3 rounded-xl border border-brand-400/40 p-3"
              >
                <legend className="px-1">
                  <SubclassChip
                    subject={group.subject}
                    name={group.subject === "math" ? "Maths · AFL" : "Eng · VAR"}
                  />
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-brand-100">
                    Sub-class name
                    <input
                      className={CLASS_CONTROL + " mt-1"}
                      value={d.name}
                      onChange={(e) => patch(group.id, { name: e.target.value })}
                    />
                  </label>
                  {isAdmin ? (
                    <label className="block text-xs font-bold text-brand-100">
                      Teacher
                      <select
                        className={CLASS_CONTROL + " mt-1"}
                        value={d.teacher_id}
                        onChange={(e) => patch(group.id, { teacher_id: e.target.value })}
                      >
                        <option value="">Not set</option>
                        {staff.map((person) => (
                          <option key={person.id} value={person.id}>
                            {personName(person, person.id)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  <label className="block text-xs font-bold text-brand-100">
                    Room
                    <input
                      className={CLASS_CONTROL + " mt-1"}
                      value={d.room}
                      onChange={(e) => patch(group.id, { room: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-bold text-brand-100">
                    Level
                    <input
                      className={CLASS_CONTROL + " mt-1"}
                      value={d.level}
                      onChange={(e) => patch(group.id, { level: e.target.value })}
                    />
                  </label>
                </div>
                <div>
                  <p className="text-xs font-bold text-brand-100">Days</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {DAY_LABELS.map((label, index) => {
                      const day = index + 1;
                      const on = d.days.includes(day);
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          className={
                            "tap rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200 " +
                            (on ? "bg-brand-300 text-white" : "bg-brand-600 text-brand-100")
                          }
                          onClick={() =>
                            patch(group.id, {
                              days: on ? d.days.filter((x) => x !== day) : [...d.days, day],
                            })
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs font-bold text-brand-100">
                    Starts
                    <input
                      type="time"
                      className={CLASS_CONTROL + " mt-1"}
                      value={d.start}
                      onChange={(e) => patch(group.id, { start: e.target.value })}
                    />
                  </label>
                  <label className="block text-xs font-bold text-brand-100">
                    Ends
                    <input
                      type="time"
                      className={CLASS_CONTROL + " mt-1"}
                      value={d.end}
                      onChange={(e) => patch(group.id, { end: e.target.value })}
                    />
                  </label>
                </div>
                {isAdmin && (
                  <MoneyInput
                    label="Fee per month (empty = not priced)"
                    value={d.fee}
                    onChange={(fee) => patch(group.id, { fee })}
                    error={feeErrors[group.id]?.error}
                    hint="Changes apply from this month; past charges are never rewritten."
                  />
                )}
                <label className="flex items-center gap-2 text-sm font-bold">
                  <input
                    type="checkbox"
                    checked={d.active}
                    onChange={(e) => patch(group.id, { active: e.target.checked })}
                  />
                  Sub-class active
                </label>
              </fieldset>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              className="tap px-2 py-2 text-xs font-bold text-brand-100"
              onClick={() => {
                if (!confirm(`Delete "${klass.name}" and both sub-classes? This cannot be undone.`))
                  return;
                void deleteClass(klass.id)
                  .then(() => {
                    toast.success("Class deleted");
                    onDeleted();
                  })
                  .catch((err) =>
                    toast.error(
                      err instanceof Error
                        ? `${err.message}. Classes with payments cannot be deleted.`
                        : "Could not delete",
                    ),
                  );
              }}
            >
              Delete class
            </button>
            <div className="flex gap-2">
              <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || invalid}
                className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
