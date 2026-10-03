import { createFileRoute, getRouteApi, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Plus, School, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { RevealCard } from "@/components/ui/reveal-card";
import { ListSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/panel";
import { SubclassChip } from "@/components/classes/SubclassChip";
import { CLASS_CONTROL } from "@/components/classes/control";
import { createClass, listAllClasses, type ClassRow } from "@/lib/classes";
import { monthKey } from "@/lib/classes/classroom";
import {
  listAllGroupMembers,
  listGroupMonthCounts,
  listGroups,
  listProfiles,
  personName,
  type ClassGroup,
  type GroupMember,
  type PersonProfile,
} from "@/lib/classes/groups";
import { scheduleLine } from "@/lib/classes/schedule";
import { subjectToSlug } from "@/lib/classes/schemes";
import { listBalances } from "@/lib/billing/api";

export const Route = createFileRoute("/_authenticated/admin/classes/")({
  component: AdminClassesIndex,
});

const adminRoute = getRouteApi("/_authenticated/admin");

function AdminClassesIndex() {
  const { staffRole, userId } = adminRoute.useRouteContext();
  const isAdmin = staffRole === "admin";
  const isTeacher = staffRole === "teacher";
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [teachers, setTeachers] = useState<Map<string, PersonProfile>>(new Map());
  const [monthCounts, setMonthCounts] = useState<Map<string, { lessons: number; attendance: number }>>(
    new Map(),
  );
  const [debtors, setDebtors] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");

  const load = useCallback(async () => {
    try {
      const [rows, groupRows] = await Promise.all([listAllClasses(), listGroups()]);
      const visibleGroups = isTeacher
        ? groupRows.filter((group) => group.teacher_id === userId)
        : groupRows;
      const visibleClasses = isTeacher
        ? rows.filter((row) => visibleGroups.some((group) => group.class_id === row.id))
        : rows;
      setClasses(visibleClasses);
      setGroups(visibleGroups);
      const [memberRows, teacherRows, counts] = await Promise.all([
        listAllGroupMembers(),
        listProfiles(visibleGroups.map((g) => g.teacher_id).filter((id): id is string => Boolean(id))),
        isTeacher
          ? listGroupMonthCounts(
              visibleGroups.map((group) => group.id),
              monthKey(),
            )
          : Promise.resolve(new Map<string, { lessons: number; attendance: number }>()),
      ]);
      setMembers(memberRows);
      setTeachers(teacherRows);
      setMonthCounts(counts);
      if (isAdmin) {
        const money = await listBalances({ kind: "debt" }).catch(() => []);
        const debt = new Map<string, number>();
        for (const row of money)
          if (row.class_id) debt.set(row.class_id, (debt.get(row.class_id) ?? 0) + 1);
        setDebtors(debt);
      }
    } finally {
      setLoading(false);
    }
  }, [isAdmin, isTeacher, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 text-brand-900">
      <div className="flex flex-col gap-3 rise-in md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">
            {isTeacher ? "Teaching" : "Classes"}
          </h1>
          <p className="mt-1 text-sm text-brand-700">
            {isTeacher
              ? "Groups an admin assigned to you. Counts are students, lessons this month, and attendance marked this month."
              : "Each class has a Maths sub-class (AFL) and an Eng sub-class (VAR)."}
          </p>
        </div>
        {!isTeacher && (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            void createClass({ name })
              .then(() => {
                setName("");
                toast.success("Class created with Maths and Eng sub-classes");
                return load();
              })
              .catch((err) =>
                toast.error(err instanceof Error ? err.message : "Could not create class"),
              );
          }}
        >
          <input
            className={CLASS_CONTROL + " w-56"}
            aria-label="New class name"
            placeholder="New class, e.g. SAT 14"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button
            className="btn-brand inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-500 px-4 py-2 text-sm font-bold text-white"
            type="submit"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Create
          </button>
        </form>
        )}
      </div>
      {loading ? (
        <ListSkeleton rows={4} />
      ) : classes.length === 0 ? (
        <EmptyState
          icon={School}
          title={isTeacher ? "No groups yet" : "No classes yet"}
          body={
            isTeacher
              ? "An admin assigns you to a Maths or Eng group from the class editor."
              : "Create a class to open its workspace."
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 stagger">
          {classes.map((row) => {
            const subs = groups
              .filter((g) => g.class_id === row.id)
              .sort((a, b) => Number(a.subject === "math") - Number(b.subject === "math"));
            const debt = debtors.get(row.id) ?? 0;
            return (
              <RevealCard
                key={row.id}
                className="lift rounded-2xl border border-brand-400/40 bg-brand-600 p-5 text-white"
              >
                <div className="flex items-start justify-between gap-2">
                  <Link
                    to="/admin/classes/$classId"
                    params={{ classId: row.id }}
                    search={{ tab: "roster" }}
                    className="tap min-w-0"
                  >
                    <h2 className="truncate text-xl font-black text-white hover:underline">{row.name}</h2>
                  </Link>
                  <div className="flex shrink-0 items-center gap-2 text-xs font-bold text-white">
                    {!row.active && <span>Inactive</span>}
                    {isAdmin && debt > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-25 px-2 py-0.5 text-brand-900">
                        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
                        {debt} debtor{debt === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-3 grid gap-2">
                  {subs.map((group) => {
                    const active = members.filter(
                      (m) => m.group_id === group.id && m.status === "active",
                    ).length;
                    const students = members.filter((m) => m.group_id === group.id).length;
                    return (
                      <Link
                        key={group.id}
                        to="/admin/classes/$classId/$subject"
                        params={{ classId: row.id, subject: subjectToSlug(group.subject) }}
                        search={{
                          tab: "attendance",
                          month: monthKey(),
                          lesson: "",
                          q: "",
                          status: "",
                          sections: 0,
                        }}
                        className="tap flex min-w-0 items-center justify-between gap-2 rounded-xl bg-brand-800/70 px-3 py-2 hover:bg-brand-500"
                      >
                        <span className="min-w-0">
                          <SubclassChip subject={group.subject} name={group.name} />
                          <span className="mt-1 block truncate text-xs text-white">
                            {group.teacher_id
                              ? personName(teachers.get(group.teacher_id), group.teacher_id)
                              : "No teacher"}{" "}
                            · {scheduleLine(group)}
                          </span>
                        </span>
                        <span className="shrink-0 text-right text-xs font-bold tabular-nums">
                          {isTeacher ? (
                            <>
                              {students} students
                              <span className="mt-0.5 block font-semibold">
                                {monthCounts.get(group.id)?.lessons ?? 0} lessons ·{" "}
                                {monthCounts.get(group.id)?.attendance ?? 0} marked
                              </span>
                            </>
                          ) : (
                            <>{active} active</>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </RevealCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
