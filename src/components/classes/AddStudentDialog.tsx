import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, Calculator, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useClassContext } from "@/components/classes/ClassContext";
import {
  displayName,
  listUsersForAdmin,
  searchUsersForAdmin,
  type ChatProfile,
  type ClassRow,
  type ClassSubject,
} from "@/lib/classes";
import { addGroupMember, type ClassGroup } from "@/lib/classes/groups";
import { isOnline, lastSeenLabel } from "@/lib/presence";
import { createClassStudent } from "@/lib/auth/create-user";
import { tashkentToday } from "@/lib/billing/dates";
import { cn } from "@/lib/utils";
import { CLASS_CONTROL } from "./control";

type Pick = "math" | "ebrw" | "both";
const TABS = ["all", "none", "other", "online"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  all: "All",
  none: "Not in a class",
  other: "In another class",
  online: "Online now",
};

/** Telegram-style picker: search, tabs, multi-select, Maths / Eng / Both per student. */
export function AddStudentDialog({
  open,
  klass,
  groups,
  defaultSubject,
  isAdmin,
  onClose,
  onAdded,
}: {
  open: boolean;
  klass: ClassRow;
  groups: ClassGroup[];
  defaultSubject: ClassSubject | null;
  isAdmin: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const { allClasses } = useClassContext();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<Tab>("all");
  const [rows, setRows] = useState<ChatProfile[]>([]);
  const [selected, setSelected] = useState<Map<string, Pick>>(new Map());
  const [focus, setFocus] = useState(0);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"active" | "trial">("active");
  const [enrolledOn, setEnrolledOn] = useState(tashkentToday());
  const [activatedOn, setActivatedOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const request = useRef(0);
  const listRef = useRef<HTMLUListElement>(null);
  const defaultPick: Pick = defaultSubject ?? "both";

  useEffect(() => {
    if (!open) return;
    setSelected(new Map());
    setQuery("");
    setTab("all");
    setEnrolledOn(tashkentToday());
    setActivatedOn("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const id = ++request.current;
    const handle = window.setTimeout(() => {
      setLoading(true);
      const job =
        query.trim().length < 2 ? listUsersForAdmin({ limit: 80 }) : searchUsersForAdmin(query, 40);
      void job
        .then((result) => {
          if (id === request.current) setRows(result);
        })
        .catch(() => id === request.current && setRows([]))
        .finally(() => id === request.current && setLoading(false));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [query, open]);

  const className = (id: string | null) => allClasses.find((row) => row.id === id)?.name ?? null;

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (tab === "none") return !row.class_id;
        if (tab === "other") return Boolean(row.class_id) && row.class_id !== klass.id;
        if (tab === "online") return isOnline(row.last_seen_at);
        return true;
      }),
    [rows, tab, klass.id],
  );

  function toggle(id: string) {
    setSelected((cur) => {
      const next = new Map(cur);
      if (next.has(id)) next.delete(id);
      else next.set(id, defaultPick);
      return next;
    });
  }

  async function confirmAdd() {
    if (!selected.size) return;
    setBusy(true);
    let added = 0;
    try {
      for (const [id, pick] of selected) {
        const person = rows.find((row) => row.id === id);
        const name = person ? displayName(person) : id.slice(0, 8);
        const other =
          person?.class_id && person.class_id !== klass.id ? className(person.class_id) : null;
        if (other && !confirm(`Move ${name} from ${other} to ${klass.name}?`)) continue;
        const subjects: ClassSubject[] = pick === "both" ? ["math", "ebrw"] : [pick];
        let moved = false;
        for (const subject of subjects) {
          const group = groups.find((g) => g.subject === subject);
          if (!group) continue;
          await addGroupMember({
            groupId: group.id,
            userId: id,
            status,
            enrolledOn,
            activatedOn: isAdmin ? activatedOn || enrolledOn : null,
            move: Boolean(other) && !moved,
          });
          moved = true;
        }
        added += 1;
      }
      if (added === 0) {
        toast.message("No students were added");
        return;
      }
      toast.success(`Added ${added} student${added === 1 ? "" : "s"}`);
      setSelected(new Map());
      onClose();
      await onAdded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add students");
    } finally {
      setBusy(false);
    }
  }

  async function createNew() {
    if (!createName.trim() || !createPassword) return;
    setBusy(true);
    try {
      await createClassStudent({ name: createName, password: createPassword, classId: klass.id });
      toast.success("Student created and added to both sub-classes");
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
      <DialogContent className="flex max-h-[92vh] flex-col gap-3 overflow-hidden border-brand-400/40 bg-brand-800 p-0 text-white sm:rounded-2xl">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="text-white">Add student</DialogTitle>
          <DialogDescription className="text-brand-100">{klass.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 px-5">
          <label className="relative block">
            <span className="sr-only">Search students</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200"
              aria-hidden="true"
            />
            <input
              autoFocus
              className={CLASS_CONTROL + " pl-9"}
              placeholder="Name, username or email"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setFocus(0);
              }}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault();
                  setFocus((f) => Math.min(visible.length - 1, f + 1));
                }
                if (event.key === "ArrowUp") {
                  event.preventDefault();
                  setFocus((f) => Math.max(0, f - 1));
                }
                if (event.key === "Enter" && visible[focus]) {
                  event.preventDefault();
                  toggle(visible[focus]!.id);
                }
              }}
            />
          </label>
          <div className="flex gap-1 overflow-x-auto" role="tablist">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                className={cn(
                  "tap whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold transition-colors duration-200",
                  tab === item ? "bg-brand-400 text-white" : "bg-brand-600 text-brand-100",
                )}
                onClick={() => {
                  setTab(item);
                  setFocus(0);
                }}
              >
                {TAB_LABEL[item]}
              </button>
            ))}
            {loading && (
              <Loader2 className="ml-auto h-4 w-4 shrink-0 animate-spin text-brand-100" />
            )}
          </div>
        </div>

        <ul
          ref={listRef}
          className="min-h-0 flex-1 divide-y divide-brand-400/30 overflow-y-auto px-5"
          aria-label="Students"
        >
          {visible.map((row, index) => {
            const here = row.class_id === klass.id;
            const other = row.class_id && !here ? className(row.class_id) : null;
            const presence = isOnline(row.last_seen_at)
              ? "online"
              : `last seen ${lastSeenLabel(row.last_seen_at)}`;
            const pick = selected.get(row.id);
            const name = displayName(row);
            return (
              <li
                key={row.id}
                className={cn("flex items-center gap-3 py-2", index === focus && "bg-brand-600/60")}
              >
                <button
                  type="button"
                  aria-pressed={pick != null}
                  className="tap flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => toggle(row.id)}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-black",
                      pick ? "bg-brand-25 text-brand-900" : "bg-brand-500",
                    )}
                  >
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold">{name}</span>
                    <span className="block truncate text-[11px] text-brand-100">
                      {presence}
                      {here ? " · in this class" : other ? ` · in ${other}` : " · not in a class"}
                    </span>
                  </span>
                </button>
                {pick && (
                  <div
                    className="flex shrink-0 rounded-full bg-brand-600 p-0.5"
                    role="group"
                    aria-label={`Sub-classes for ${name}`}
                  >
                    {(
                      [
                        ["math", "Maths", Calculator],
                        ["ebrw", "Eng", BookOpen],
                        ["both", "Both", null],
                      ] as const
                    ).map(([value, label, Icon]) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={pick === value}
                        className={cn(
                          "tap inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold",
                          pick === value ? "bg-brand-300 text-white" : "text-brand-100",
                        )}
                        onClick={() => setSelected((cur) => new Map(cur).set(row.id, value))}
                      >
                        {Icon && <Icon className="h-3 w-3" aria-hidden="true" />}
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
          {!loading && visible.length === 0 && (
            <li className="py-6 text-center text-sm text-brand-100">No students match</li>
          )}
        </ul>

        <div className="space-y-3 border-t border-brand-400/30 bg-brand-800 px-5 pb-5 pt-3">
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block text-xs font-bold text-brand-100">
              Status
              <select
                className={CLASS_CONTROL + " mt-1"}
                value={status}
                onChange={(e) => setStatus(e.target.value as "active" | "trial")}
              >
                <option value="active">Active</option>
                <option value="trial">Trial</option>
              </select>
            </label>
            <label className="block text-xs font-bold text-brand-100">
              Enrolled on
              <input
                type="date"
                className={CLASS_CONTROL + " mt-1"}
                value={enrolledOn}
                onChange={(e) => setEnrolledOn(e.target.value)}
              />
            </label>
            {isAdmin && (
              <label className="block text-xs font-bold text-brand-100">
                Activated on (billing)
                <input
                  type="date"
                  className={CLASS_CONTROL + " mt-1"}
                  value={activatedOn || enrolledOn}
                  onChange={(e) => setActivatedOn(e.target.value)}
                />
              </label>
            )}
          </div>
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => void confirmAdd()}
            className="btn-brand w-full rounded-full bg-brand-400 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {busy ? "Adding…" : `Add ${selected.size} student${selected.size === 1 ? "" : "s"}`}
          </button>
          <details className="text-sm">
            <summary className="tap cursor-pointer text-xs font-bold text-brand-100">
              Create a new student account
            </summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input
                className={CLASS_CONTROL}
                placeholder="Full name"
                aria-label="Full name"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
              />
              <input
                className={CLASS_CONTROL}
                placeholder="Password"
                aria-label="Password"
                type="password"
                value={createPassword}
                onChange={(e) => setCreatePassword(e.target.value)}
              />
              <button
                type="button"
                disabled={busy || !createName.trim() || !createPassword}
                onClick={() => void createNew()}
                className="tap rounded-full bg-brand-500 px-4 py-2 text-xs font-bold disabled:opacity-40"
              >
                Create
              </button>
            </div>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
