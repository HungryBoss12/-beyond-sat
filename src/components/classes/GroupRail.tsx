import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  CalendarClock,
  CircleCheck,
  EllipsisVertical,
  FlaskConical,
  Info,
  Search,
  Snowflake,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { STATUS_META } from "@/components/billing/meta";
import { CLASS_CONTROL } from "@/components/classes/control";
import type { ClassRow, MemberStatus } from "@/lib/classes/types";
import {
  addGroupMember,
  listGroups,
  removeGroupMember,
  setGroupMemberStatus,
  type ClassGroup,
} from "@/lib/classes/groups";
import { scheduleLine } from "@/lib/classes/schedule";
import { formatUzs, type BalanceKind } from "@/lib/billing/money";
import { cn } from "@/lib/utils";

export type RailPerson = {
  userId: string;
  name: string;
  status: Exclude<MemberStatus, "left">;
  inSibling: boolean;
  /** Admin only. */
  balanceKind?: BalanceKind;
};

export type RailFilter = "" | "active" | "trial" | "frozen" | "debt";

const LEGEND: {
  id: Exclude<RailFilter, "">;
  label: string;
  icon: typeof CircleCheck;
  adminOnly?: boolean;
}[] = [
  { id: "active", label: "Active", icon: CircleCheck },
  { id: "debt", label: "Debtor", icon: TriangleAlert, adminOnly: true },
  { id: "trial", label: "Trial", icon: FlaskConical },
  { id: "frozen", label: "Frozen", icon: Snowflake },
];

export function GroupRail({
  klass,
  group,
  sibling,
  people,
  teacherName,
  fee,
  isAdmin,
  query,
  filter,
  allClasses,
  onQuery,
  onFilter,
  onAdd,
  onActivation,
  onChanged,
}: {
  klass: ClassRow;
  group: ClassGroup;
  sibling: ClassGroup | null;
  people: RailPerson[];
  teacherName: string | null;
  /** undefined = editor (hidden); null = not set. */
  fee: bigint | null | undefined;
  isAdmin: boolean;
  query: string;
  filter: RailFilter;
  allClasses: ClassRow[];
  onQuery: (q: string) => void;
  onFilter: (f: RailFilter) => void;
  onAdd: () => void;
  onActivation: (userId: string) => void;
  onChanged: () => Promise<void>;
}) {
  const [moving, setMoving] = useState<RailPerson | null>(null);

  async function changeStatus(person: RailPerson, status: Exclude<MemberStatus, "left">) {
    try {
      await setGroupMemberStatus(group.id, person.userId, status);
      toast.success(`${person.name} · ${STATUS_META[status].label}`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change the status");
    }
  }

  async function remove(person: RailPerson) {
    if (!confirm(`Remove ${person.name} from ${group.name}?`)) return;
    try {
      await removeGroupMember(group.id, person.userId);
      toast.success(`${person.name} removed from ${group.name}`);
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove the student");
    }
  }

  const info: [string, string][] = [
    ["Teacher", teacherName ?? "Not set"],
    ["Time", scheduleLine(group)],
    ["Room", group.room ?? "—"],
    ["Level", group.level ?? "—"],
  ];
  if (fee !== undefined) info.push(["Fee", fee == null ? "Not set" : `${formatUzs(fee)} / month`]);

  return (
    <aside className="min-w-0 space-y-3" aria-label={`${group.name} roster`}>
      <Panel tone="brand" className="space-y-2 p-4 md:p-4">
        <p className="text-[11px] font-bold tracking-[0.08em] text-brand-100">
          {klass.name.toUpperCase()}
        </p>
        <h2 className="truncate text-lg font-black">{group.name}</h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          {info.map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-brand-100">{label}</dt>
              <dd className="min-w-0 truncate font-bold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel className="space-y-3 p-3 md:p-3">
        <div className="flex items-center gap-2">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search roster</span>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-200"
              aria-hidden="true"
            />
            <input
              className={CLASS_CONTROL + " pl-9"}
              placeholder="Search roster"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
            />
          </label>
          <IconButton icon={UserPlus} label="Add student" variant="brand" onClick={onAdd} />
        </div>
        <div className="flex flex-wrap gap-1" role="group" aria-label="Status filter">
          {LEGEND.filter((item) => isAdmin || !item.adminOnly).map((item) => {
            const Icon = item.icon;
            const on = filter === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={on}
                onClick={() => onFilter(on ? "" : item.id)}
                className={cn(
                  "tap inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold transition-colors duration-200",
                  on ? "bg-brand-25 text-brand-900" : "bg-brand-800 text-brand-100",
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {item.label}
              </button>
            );
          })}
        </div>
        <ul className="stagger-fast space-y-0.5">
          {people.map((person) => {
            const StatusIcon = STATUS_META[person.status].icon;
            const subtitle = [
              STATUS_META[person.status].label,
              person.inSibling && sibling ? `Also in ${sibling.name}` : null,
              isAdmin && person.balanceKind && person.balanceKind !== "settled"
                ? person.balanceKind === "debt"
                  ? "Debtor"
                  : "Credit"
                : null,
            ].filter(Boolean);
            return (
              <li
                key={person.userId}
                className="flex items-center gap-1 rounded-lg px-1 hover:bg-brand-500/60"
              >
                <StatusIcon className="h-3.5 w-3.5 shrink-0 text-brand-100" aria-hidden="true" />
                <div className="min-w-0 flex-1 py-1.5">
                  <div className="flex min-w-0 items-center gap-1">
                    <span className="truncate text-sm font-bold">{person.name}</span>
                    {isAdmin && person.balanceKind === "debt" && (
                      <TriangleAlert className="h-3 w-3 shrink-0" aria-label="Debtor" />
                    )}
                  </div>
                  <div className="truncate text-[11px] text-brand-100">{subtitle.join(" · ")}</div>
                </div>
                <Link
                  to="/admin/classes/$classId/students/$userId"
                  params={{ classId: klass.id, userId: person.userId }}
                  aria-label={`Profile of ${person.name}`}
                  className="tap grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-200"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <IconButton
                      icon={EllipsisVertical}
                      label={`Actions for ${person.name}`}
                      className="h-9 min-w-9 w-9 text-white hover:bg-brand-500"
                    />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Status</DropdownMenuLabel>
                    {(["active", "trial", "frozen"] as const).map((status) => (
                      <DropdownMenuItem
                        key={status}
                        disabled={person.status === status}
                        onSelect={() => void changeStatus(person, status)}
                      >
                        {STATUS_META[status].label}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                    {isAdmin && (
                      <DropdownMenuItem onSelect={() => onActivation(person.userId)}>
                        <CalendarClock className="mr-2 h-4 w-4" aria-hidden="true" />
                        Activation date
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => setMoving(person)}>
                      Move to another class…
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void remove(person)}>
                      Remove from {group.name}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </li>
            );
          })}
          {people.length === 0 && (
            <li className="px-2 py-4 text-sm text-brand-100">No students match.</li>
          )}
        </ul>
      </Panel>

      <MoveDialog
        person={moving}
        group={group}
        klass={klass}
        allClasses={allClasses}
        onClose={() => setMoving(null)}
        onMoved={onChanged}
      />
    </aside>
  );
}

function MoveDialog({
  person,
  group,
  klass,
  allClasses,
  onClose,
  onMoved,
}: {
  person: RailPerson | null;
  group: ClassGroup;
  klass: ClassRow;
  allClasses: ClassRow[];
  onClose: () => void;
  onMoved: () => Promise<void>;
}) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const options = allClasses.filter((c) => c.id !== klass.id);

  async function move() {
    if (!person || !target) return;
    setBusy(true);
    try {
      const groups = await listGroups(target);
      const destination = groups.find((g) => g.subject === group.subject);
      if (!destination) throw new Error("That class has no matching sub-class");
      await addGroupMember({
        groupId: destination.id,
        userId: person.userId,
        status: person.status,
        move: true,
      });
      toast.success(`${person.name} moved to ${destination.name}`);
      onClose();
      await onMoved();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not move the student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={person != null} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-white">Move student</DialogTitle>
          <DialogDescription className="text-brand-100">
            {person?.name} leaves {klass.name} (both sub-classes) and joins the same subject in the
            new class.
          </DialogDescription>
        </DialogHeader>
        <select
          aria-label="Target class"
          className={CLASS_CONTROL}
          value={target}
          onChange={(e) => setTarget(e.target.value)}
        >
          <option value="">Pick a class</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div className="flex justify-end gap-2">
          <button type="button" className="tap px-4 py-2 text-sm font-bold" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !target}
            onClick={() => void move()}
            className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            Move
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
