import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { ChevronLeft, Info, Pencil, Trophy, UserPlus, Users } from "lucide-react";
import { Panel, PanelGlow, EmptyState } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";
import { IconButton } from "@/components/ui/icon-button";
import { useClassContext } from "@/components/classes/ClassContext";
import { ClassEditDialog } from "@/components/classes/ClassEditDialog";
import { AddStudentDialog } from "@/components/classes/AddStudentDialog";
import { RankingTable } from "@/components/classes/RankingTable";
import { SubclassChip } from "@/components/classes/SubclassChip";
import { BalanceLabel, StatusLabel } from "@/components/billing/labels";
import { listScores, monthKey } from "@/lib/classes/classroom";
import {
  listClassGroupMembers,
  listProfiles,
  personName,
  type ClassGroup,
  type GroupMember,
  type PersonProfile,
} from "@/lib/classes/groups";
import { scheduleLine } from "@/lib/classes/schedule";
import { subjectToSlug } from "@/lib/classes/schemes";
import { listBalances } from "@/lib/billing/api";
import { cn } from "@/lib/utils";

const searchSchema = z.object({
  tab: z.enum(["roster", "ranking"]).catch("roster"),
});

export const Route = createFileRoute("/_authenticated/admin/classes/$classId/")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    searchSchema.parse(search),
  component: ClassOverview,
});

function ClassOverview() {
  const { klass, groups, isAdmin, reload } = useClassContext();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [profiles, setProfiles] = useState<Map<string, PersonProfile>>(new Map());
  const [scores, setScores] = useState<Map<string, { rw: number; math: number }>>(new Map());
  const [balances, setBalances] = useState<Map<string, bigint>>(new Map());
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const rows = await listClassGroupMembers(klass.id);
      const ids = [...new Set(rows.map((r) => r.user_id))];
      const teacherIds = groups.map((g) => g.teacher_id).filter((id): id is string => Boolean(id));
      const [people, scoreRows] = await Promise.all([
        listProfiles([...ids, ...teacherIds]),
        listScores(ids),
      ]);
      setMembers(rows);
      setProfiles(people);
      setScores(new Map(scoreRows.map((s) => [s.user_id, { rw: s.rw, math: s.math }])));
      if (isAdmin) {
        const money = await listBalances({ classId: klass.id }).catch(() => []);
        setBalances(new Map(money.map((m) => [m.user_id, m.balance])));
      }
    } finally {
      setLoading(false);
    }
  }, [klass.id, groups, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const roster = useMemo(() => {
    const byUser = new Map<string, GroupMember[]>();
    for (const row of members) byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
    return [...byUser.entries()]
      .map(([userId, rows]) => ({ userId, name: personName(profiles.get(userId), userId), rows }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [members, profiles]);

  const rankRows = roster.map((person) => ({
    userId: person.userId,
    name: person.name,
    rw: scores.get(person.userId)?.rw ?? null,
    math: scores.get(person.userId)?.math ?? null,
  }));

  return (
    <div className="space-y-5 text-brand-900">
      <Link
        to="/admin/classes"
        className="tap inline-flex items-center gap-1 text-sm font-bold text-brand-700"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Classes
      </Link>

      <Panel tone="brand" className="relative overflow-hidden">
        <PanelGlow />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold tracking-[0.08em] text-brand-100">PARENT CLASS</p>
            <h1 className="truncate text-2xl font-black md:text-3xl">{klass.name}</h1>
            {klass.description && (
              <p className="mt-1 text-sm text-brand-100">{klass.description}</p>
            )}
            {!klass.active && <p className="mt-1 text-xs font-bold text-brand-100">Inactive</p>}
          </div>
          <div className="flex gap-2">
            <IconButton
              icon={UserPlus}
              label="Add student"
              variant="brand"
              onClick={() => setAddOpen(true)}
            />
            <IconButton
              icon={Pencil}
              label="Edit class"
              className="text-white hover:bg-brand-500"
              onClick={() => setEditOpen(true)}
            />
          </div>
        </div>
        <div className="relative mt-4 grid gap-3 sm:grid-cols-2">
          {groups.map((group) => (
            <SubclassCard
              key={group.id}
              group={group}
              classId={klass.id}
              teacher={
                group.teacher_id
                  ? personName(profiles.get(group.teacher_id), group.teacher_id)
                  : null
              }
              active={
                members.filter((m) => m.group_id === group.id && m.status === "active").length
              }
            />
          ))}
        </div>
      </Panel>

      <div className="relative isolate flex w-fit rounded-full bg-brand-25 p-1" role="tablist">
        <span
          aria-hidden="true"
          className="nav-tab-pill absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-full bg-brand-500"
          style={{ transform: `translateX(${search.tab === "ranking" ? "100%" : "0"})` }}
        />
        {(
          [
            ["roster", "Roster", Users],
            ["ranking", "Ranking", Trophy],
          ] as const
        ).map(([tab, label, Icon]) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={search.tab === tab}
            className={cn(
              "tap relative z-10 flex items-center gap-1.5 rounded-full px-5 py-1.5 text-sm font-bold transition-colors duration-200",
              search.tab === tab ? "text-white" : "text-brand-700",
            )}
            onClick={() =>
              void navigate({
                to: "/admin/classes/$classId",
                params: { classId: klass.id },
                search: { tab },
              })
            }
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No students yet"
          body="Add students to Maths, Eng or both."
        />
      ) : search.tab === "ranking" ? (
        <Panel>
          <RankingTable students={rankRows} onSaved={load} />
        </Panel>
      ) : (
        <Panel className="p-0 md:p-0">
          <ul className="divide-y divide-brand-400/30">
            {roster.map((person) => (
              <li key={person.userId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <Link
                    to="/admin/classes/$classId/students/$userId"
                    params={{ classId: klass.id, userId: person.userId }}
                    className="tap block truncate font-bold hover:underline"
                  >
                    {person.name}
                  </Link>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {[...person.rows]
                      .sort((a, b) => a.subject.localeCompare(b.subject))
                      .map((row) => {
                        const group = groups.find((g) => g.id === row.group_id);
                        return (
                          <span key={row.group_id} className="inline-flex items-center gap-1">
                            <SubclassChip
                              subject={row.subject}
                              name={row.subject === "math" ? "M" : "E"}
                            />
                            <StatusLabel status={row.status} className="text-brand-100" />
                            <span className="sr-only">{group?.name}</span>
                          </span>
                        );
                      })}
                  </div>
                </div>
                {isAdmin && balances.has(person.userId) && (
                  <BalanceLabel balance={balances.get(person.userId)!} className="text-xs" />
                )}
                <Link
                  to="/admin/classes/$classId/students/$userId"
                  params={{ classId: klass.id, userId: person.userId }}
                  aria-label={`Profile of ${person.name}`}
                  className="tap grid h-10 w-10 place-items-center rounded-full hover:bg-brand-500"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <ClassEditDialog
        open={editOpen}
        klass={klass}
        groups={groups}
        isAdmin={isAdmin}
        onClose={() => setEditOpen(false)}
        onSaved={async () => {
          await reload();
          await load();
        }}
        onDeleted={() => void navigate({ to: "/admin/classes" })}
      />
      <AddStudentDialog
        open={addOpen}
        klass={klass}
        groups={groups}
        defaultSubject={null}
        isAdmin={isAdmin}
        onClose={() => setAddOpen(false)}
        onAdded={load}
      />
    </div>
  );
}

function SubclassCard({
  group,
  classId,
  teacher,
  active,
}: {
  group: ClassGroup;
  classId: string;
  teacher: string | null;
  active: number;
}) {
  return (
    <Link
      to="/admin/classes/$classId/$subject"
      params={{ classId, subject: subjectToSlug(group.subject) }}
      search={{ tab: "attendance", month: monthKey(), lesson: "", q: "", status: "", sections: 0 }}
      className="lift tap block min-w-0 rounded-xl border border-brand-400/40 bg-brand-600/70 p-3 hover:bg-brand-500"
    >
      <SubclassChip subject={group.subject} name={group.name} />
      <p className="mt-2 truncate text-sm font-bold">{scheduleLine(group)}</p>
      <p className="truncate text-xs text-brand-100">
        {teacher ? `Teacher ${teacher}` : "No teacher set"} · {active} active
        {group.room ? ` · Room ${group.room}` : ""}
        {group.active ? "" : " · inactive"}
      </p>
    </Link>
  );
}
