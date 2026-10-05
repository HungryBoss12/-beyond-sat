import { createFileRoute, Link, useNavigate, type SearchSchemaInput } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { Check, ChevronLeft, Minus, Pencil, Wallet, X } from "lucide-react";
import { Panel, PanelGlow, PanelHead } from "@/components/ui/panel";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useClassContext } from "@/components/classes/ClassContext";
import { StudentMoney } from "@/components/classes/StudentMoney";
import { RankBadge } from "@/components/classes/RankBadge";
import { SubclassChip } from "@/components/classes/SubclassChip";
import { LevelValue, SectionToggle } from "@/components/classes/LevelTab";
import { StatusLabel } from "@/components/billing/labels";
import { getMyScore, monthKey } from "@/lib/classes/classroom";
import {
  levelBoard,
  listLessonsById,
  listLevelSections,
  listProfiles,
  listRecentGroupLessons,
  listStudentSubmissions,
  listUserAttendance,
  listUserGroupMemberships,
  listUserHwMarks,
  listUserResults,
  personName,
  type ClassGroup,
  type GroupLesson,
  type GroupMember,
  type HwMark,
  type LevelBoardRow,
  type LevelSection,
  type StudentSubmission,
} from "@/lib/classes/groups";
import { rankFor, totalScore } from "@/lib/classes/ranking";
import { resultLabel } from "@/lib/classes/results";
import { HW_ITEM_LABEL, HW_ITEM_LETTER, itemsFor, subjectToSlug } from "@/lib/classes/schemes";
import { shortDate } from "@/lib/classes/schedule";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { updateStudentProfile } from "@/lib/students/api";
import { toast } from "sonner";

const searchSchema = z.object({
  sections: z.coerce
    .number()
    .transform((n) => (n === 1 ? 1 : 0) as 0 | 1)
    .catch(0),
});

export const Route = createFileRoute("/_authenticated/admin/classes/$classId/students/$userId")({
  validateSearch: (search: Record<string, unknown> & SearchSchemaInput) =>
    searchSchema.parse(search),
  component: StudentProfilePage,
});

type GroupBlock = {
  group: ClassGroup;
  member: GroupMember;
  recent: GroupLesson[];
  level: LevelBoardRow | null;
  sections: LevelSection[];
};

function StudentProfilePage() {
  const { userId } = Route.useParams();
  const search = Route.useSearch();
  const navigate = useNavigate();
  const { klass, groups, isAdmin } = useClassContext();
  const [name, setName] = useState("Student");
  const [description, setDescription] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<GroupBlock[]>([]);
  const [score, setScore] = useState<{ rw: number; math: number } | null>(null);
  const [attendance, setAttendance] = useState<
    { group_id: string; lesson_date: string; participated: boolean }[]
  >([]);
  const [marks, setMarks] = useState<(HwMark & { group_id: string })[]>([]);
  const [results, setResults] = useState<
    { lesson: GroupLesson | undefined; m1: number | null; m2: number | null; group_id: string }[]
  >([]);
  const [submissions, setSubmissions] = useState<StudentSubmission[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const load = useCallback(async () => {
    const [profiles, memberships, myScore, attendanceRows, markRows, resultRows, subs] =
      await Promise.all([
        listProfiles([userId]),
        listUserGroupMemberships([userId]),
        getMyScore(userId).catch(() => null),
        listUserAttendance(userId, 60).catch(() => []),
        listUserHwMarks(userId).catch(() => []),
        listUserResults(userId).catch(() => []),
        listStudentSubmissions(userId).catch(() => []),
      ]);
    setName(personName(profiles.get(userId), userId));
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: studentRow } = await (supabase as any)
      .from("students")
      .select("description")
      .eq("user_id", userId)
      .maybeSingle();
    setDescription((studentRow?.description as string | null) ?? null);
    setScore(myScore ? { rw: myScore.rw, math: myScore.math } : null);
    setAttendance(attendanceRows);
    setMarks(markRows);
    setSubmissions(subs);
    const lessonMap = new Map(
      (await listLessonsById(resultRows.map((r) => r.lesson_id))).map((l) => [l.id, l]),
    );
    setResults(
      resultRows
        .map((r) => ({
          lesson: lessonMap.get(r.lesson_id),
          m1: r.m1,
          m2: r.m2,
          group_id: r.group_id,
        }))
        .sort((a, b) => (a.lesson?.lesson_date ?? "").localeCompare(b.lesson?.lesson_date ?? "")),
    );
    const mine = memberships.filter((m) => groups.some((g) => g.id === m.group_id));
    setBlocks(
      await Promise.all(
        mine.map(async (member) => {
          const group = groups.find((g) => g.id === member.group_id)!;
          const [recent, board, sections] = await Promise.all([
            listRecentGroupLessons(group.id, 8),
            levelBoard(group.id).catch(() => []),
            listLevelSections(group.subject),
          ]);
          return {
            group,
            member,
            recent,
            level: board.find((r) => r.user_id === userId) ?? null,
            sections,
          };
        }),
      ),
    );
  }, [userId, groups]);

  useEffect(() => {
    void load();
  }, [load]);

  const total = score ? totalScore(score.rw, score.math) : null;
  const firstGroup = blocks[0]?.group ?? groups[0];
  const expanded = search.sections === 1;
  const done = useMemo(
    () => new Set(marks.filter((m) => m.done).map((m) => `${m.lesson_id}:${m.item}`)),
    [marks],
  );

  return (
    <div className="space-y-5 text-brand-900">
      <nav
        aria-label="Breadcrumb"
        className="flex flex-wrap items-center gap-1 text-sm font-bold text-brand-700"
      >
        <Link to="/admin/classes" className="tap hover:underline">
          Students
        </Link>
        <span aria-hidden="true">/</span>
        <Link
          to="/admin/classes/$classId"
          params={{ classId: klass.id }}
          search={{ tab: "roster" }}
          className="tap hover:underline"
        >
          {klass.name}
        </Link>
        <span aria-hidden="true">/</span>
        <span>Student profile</span>
      </nav>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <h1 className="truncate text-2xl font-black tracking-tight md:text-3xl">{name}</h1>
          {blocks.map((b) => (
            <SubclassChip
              key={b.group.id}
              subject={b.group.subject}
              name={b.group.name}
              className="border-brand-300 text-brand-700"
            />
          ))}
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setEditName(name);
                setEditNotes(description ?? "");
                setEditOpen(true);
              }}
              className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-brand-200 px-4 text-sm font-bold text-brand-700 hover:bg-brand-25"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
          )}
          {isAdmin && (
            <Link
              to="/admin/payments"
              className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-brand-200 px-4 text-sm font-bold text-brand-700 hover:bg-brand-25"
            >
              <Wallet className="h-4 w-4" aria-hidden="true" />
              All balances
            </Link>
          )}
          {firstGroup && (
            <Link
              to="/admin/classes/$classId/$subject"
              params={{ classId: klass.id, subject: subjectToSlug(firstGroup.subject) }}
              search={{
                tab: "attendance",
                month: monthKey(),
                lesson: "",
                q: "",
                status: "",
                sections: 0,
              }}
              className="tap inline-flex h-10 items-center gap-1.5 rounded-full border border-brand-200 px-4 text-sm font-bold text-brand-700 hover:bg-brand-25"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Classroom
            </Link>
          )}
        </div>
      </div>

      <Panel tone="brand" className="relative overflow-hidden">
        <PanelGlow />
        <div className="relative flex flex-wrap items-center gap-4">
          <span
            aria-hidden="true"
            className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-400 text-2xl font-black"
          >
            {name.slice(0, 1).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold tracking-[0.08em] text-white">
              STUDENT PROFILE
            </p>
            <p className="truncate text-xl font-black text-white">{name}</p>
            {description && (
              <p className="mt-2 max-w-xl whitespace-pre-wrap text-sm text-white">{description}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-white">
              {blocks.map((b) => (
                <span key={b.group.id} className="inline-flex items-center gap-1">
                  {b.group.subject === "math" ? "Maths" : "Eng"}:{" "}
                  <StatusLabel status={b.member.status} />
                  {isAdmin && (
                    <span className="tabular-nums">· Activated {b.member.activated_on ?? "—"}</span>
                  )}
                </span>
              ))}
              {blocks.length === 0 && <span>Not in a sub-class of {klass.name}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {total != null ? (
              <RankBadge letter={rankFor(total).letter} total={total} size="lg" />
            ) : (
              <span className="text-sm text-white">No score yet</span>
            )}
          </div>
        </div>
      </Panel>

      {isAdmin && <StudentMoney userId={userId} name={name} />}

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md border-brand-400/40 bg-brand-600 text-white shadow-none sm:rounded-2xl [&>button]:!bg-transparent [&>button]:!text-white">
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              setSavingProfile(true);
              void updateStudentProfile({
                userId,
                fullName: editName,
                description: editNotes,
              })
                .then(async () => {
                  setEditOpen(false);
                  toast.success("Student updated");
                  await load();
                })
                .catch((err) =>
                  toast.error(err instanceof Error ? err.message : "Could not save the student"),
                )
                .finally(() => setSavingProfile(false));
            }}
          >
            <DialogHeader className="space-y-0 text-left">
              <DialogTitle className="text-lg font-black text-white">Edit student</DialogTitle>
            </DialogHeader>
            <label className="block text-xs font-bold text-white">
              Name
              <input
                value={editName}
                onChange={(event) => setEditName(event.target.value)}
                className="mt-1 w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white"
              />
            </label>
            <label className="block text-xs font-bold text-white">
              Notes
              <textarea
                value={editNotes}
                onChange={(event) => setEditNotes(event.target.value)}
                rows={5}
                placeholder={"English: \nAchievement: \nGoal:"}
                className="mt-1 w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white"
              />
            </label>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                {savingProfile ? "Saving" : "Save"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 lg:grid-cols-2">
        {blocks.map((block) => {
          const items = itemsFor(block.group.subject);
          const groupAttendance = attendance
            .filter((a) => a.group_id === block.group.id)
            .slice(0, 20)
            .reverse();
          const groupResults = results.filter((r) => r.group_id === block.group.id).slice(-8);
          return (
            <Panel key={block.group.id} className="space-y-4">
              <PanelHead
                label={block.group.name}
                hint={`${block.group.subject === "math" ? "AFL" : "VAR"} · last 8 lessons`}
              />
              <section aria-label="Attendance">
                <p className="text-xs font-bold text-white">Attendance</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {groupAttendance.length === 0 && (
                    <span className="text-xs text-white">No attendance yet</span>
                  )}
                  {groupAttendance.map((a) => (
                    <span
                      key={a.lesson_date}
                      title={`${shortDate(a.lesson_date)}: ${a.participated ? "present" : "absent"}`}
                      className={cn(
                        "grid h-7 w-7 place-items-center rounded-md",
                        a.participated
                          ? "bg-brand-25 text-brand-900"
                          : "bg-brand-800 text-brand-200",
                      )}
                    >
                      {a.participated ? (
                        <Check className="h-3.5 w-3.5" aria-label="present" />
                      ) : (
                        <X className="h-3.5 w-3.5" aria-label="absent" />
                      )}
                    </span>
                  ))}
                </div>
              </section>
              <section aria-label="Homework ticks">
                <p className="text-xs font-bold text-white">
                  {block.group.subject === "math" ? "AFL" : "VAR"} completion
                </p>
                <div className="mt-1 overflow-x-auto">
                  <table className="text-xs">
                    <tbody>
                      {items.map((item) => (
                        <tr key={item}>
                          <th
                            scope="row"
                            className="pr-2 text-left font-bold"
                            title={HW_ITEM_LABEL[item]}
                          >
                            {HW_ITEM_LETTER[item]}
                          </th>
                          {block.recent.map((lesson) => {
                            const on = done.has(`${lesson.id}:${item}`);
                            return (
                              <td key={lesson.id} className="p-0.5">
                                <span
                                  title={`${HW_ITEM_LABEL[item]} ${shortDate(lesson.lesson_date)}: ${on ? "done" : "not done"}`}
                                  className={cn(
                                    "grid h-6 w-6 place-items-center rounded-full",
                                    on
                                      ? "bg-brand-25 text-brand-900"
                                      : "bg-brand-800 text-brand-300",
                                  )}
                                >
                                  {on ? (
                                    <Check className="h-3 w-3" aria-label="done" />
                                  ) : (
                                    <Minus className="h-3 w-3" aria-label="not done" />
                                  )}
                                </span>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
              <section aria-label="Level" className="rounded-xl bg-brand-800 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-white">Level</p>
                    <LevelValue row={block.level ?? undefined} />
                  </div>
                  <SectionToggle
                    expanded={expanded}
                    onToggle={() =>
                      void navigate({
                        to: "/admin/classes/$classId/students/$userId",
                        params: { classId: klass.id, userId },
                        search: { sections: expanded ? 0 : 1 },
                        replace: true,
                      })
                    }
                  />
                </div>
                {expanded && (
                  <ul className="mt-2 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                    {block.sections.map((section) => {
                      const cell = block.level?.scores[section.slug];
                      return (
                        <li key={section.id} className="flex justify-between gap-2">
                          <span className="truncate text-white">{section.name}</span>
                          <span className="font-bold tabular-nums">{cell?.score ?? "—"}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
              <section aria-label="Results">
                <p className="text-xs font-bold text-white">Results (M1 + M2)</p>
                {groupResults.length === 0 ? (
                  <p className="mt-1 text-xs text-white">No results yet</p>
                ) : (
                  <ul className="mt-1 flex flex-wrap gap-1.5 text-xs">
                    {groupResults.map((r, i) => (
                      <li key={i} className="rounded-lg bg-brand-800 px-2 py-1 tabular-nums">
                        {r.lesson ? shortDate(r.lesson.lesson_date) : "—"}:{" "}
                        <span className="font-black">{resultLabel(r.m1, r.m2, block.group.subject)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </Panel>
          );
        })}
      </div>

      <Panel className="space-y-2">
        <PanelHead label="Homework" hint="Latest submissions" />
        {submissions.length === 0 ? (
          <p className="text-sm text-white">No submissions yet.</p>
        ) : (
          <ul className="divide-y divide-brand-400/30 text-sm">
            {submissions.map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-2 py-2">
                <span className="min-w-0 truncate">
                  {s.homework_assignments?.title ?? "Homework"}
                </span>
                <span className="shrink-0 text-xs text-white tabular-nums">
                  {s.status.replace("_", " ")}
                  {s.score != null
                    ? ` · ${s.score}${s.homework_assignments?.max_score ? `/${s.homework_assignments.max_score}` : ""}`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
