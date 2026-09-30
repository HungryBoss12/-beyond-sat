import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Plus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Panel, PanelGlow } from "@/components/ui/panel";
import { ListSkeleton } from "@/components/ui/skeletons";
import { RankBadge } from "@/components/classes/RankBadge";
import { ChatPanel } from "@/components/classes/ChatPanel";
import { HomeworkPanel } from "@/components/classes/HomeworkPanel";
import { AddStudentDialog } from "@/components/classes/AddStudentDialog";
import { AttendanceLessonGrid, VarLessonGrid } from "@/components/classes/LessonGrids";
import { RankingTable } from "@/components/classes/RankingTable";
import {
  deleteClass,
  displayName,
  getChatProfile,
  updateClass,
  type ClassRow,
  type MemberStatus,
} from "@/lib/classes";
import { rankFor, totalScore } from "@/lib/classes/ranking";
import {
  DAY_LABELS,
  ensureClassLessons,
  listClassLessons,
  listMemberships,
  listScores,
  listVarMarks,
  monthKey,
  shiftMonth,
  type ClassLesson,
} from "@/lib/classes/classroom";
import { listClassAttendanceOnDate } from "@/lib/classes";
import { CLASS_CONTROL } from "./control";

const TABS = ["attendance", "var", "ranking", "homework", "chat"] as const;
type Tab = (typeof TABS)[number];

export function ClassroomWorkspace({
  classRow,
  tab,
  month,
  lesson,
  isAdmin,
  onNavigate,
  onChanged,
}: {
  classRow: ClassRow;
  tab: Tab;
  month: string;
  lesson: string;
  isAdmin: boolean;
  onNavigate: (patch: { tab?: Tab; month?: string; lesson?: string }) => void;
  onChanged: () => Promise<void>;
}) {
  const [people, setPeople] = useState<
    { userId: string; name: string; status: MemberStatus; phone: string }[]
  >([]);
  const [scores, setScores] = useState<Map<string, { rw: number; math: number }>>(new Map());
  const [lessons, setLessons] = useState<ClassLesson[]>([]);
  const [present, setPresent] = useState<Set<string>>(new Set());
  const [absent, setAbsent] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Awaited<ReturnType<typeof listVarMarks>>>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureClassLessons(classRow.id, month).catch(() => 0);
      const memberships = await listMemberships(classRow.id);
      const nextPeople = [];
      for (const member of memberships) {
        const profile = await getChatProfile(member.user_id).catch(() => null);
        nextPeople.push({
          userId: member.user_id,
          name: profile ? displayName(profile) : member.user_id.slice(0, 8),
          status: member.status,
          phone: "",
        });
      }
      setPeople(nextPeople);
      const scoreRows = await listScores(memberships.map((member) => member.user_id));
      setScores(new Map(scoreRows.map((row) => [row.user_id, { rw: row.rw, math: row.math }])));
      const lessonRows = await listClassLessons(classRow.id, month);
      setLessons(lessonRows);
      const here = new Set<string>();
      const gone = new Set<string>();
      for (const item of lessonRows) {
        const rows = await listClassAttendanceOnDate(classRow.id, item.lesson_date, item.subject);
        for (const row of rows) {
          const key = `${row.user_id}:${item.lesson_date}:${item.subject ?? ""}`;
          if (row.participated) here.add(key);
          else gone.add(key);
        }
      }
      setPresent(here);
      setAbsent(gone);
      setMarks(await listVarMarks(lessonRows.map((item) => item.id)));
    } finally {
      setLoading(false);
    }
  }, [classRow.id, month]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = people.filter((person) =>
    person.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  function scheduleLine(
    label: string,
    days: number[] | null | undefined,
    start?: string | null,
    end?: string | null,
  ) {
    const names = (days ?? [])
      .map((day) => DAY_LABELS[day - 1])
      .filter(Boolean)
      .join(" ");
    const time = [start, end].filter(Boolean).join("–");
    if (!names && !time) return `${label} NOT SET`;
    return `${label} ${names} ${time}`.trim();
  }

  const rankRows = useMemo(
    () =>
      filtered.map((person) => {
        const score = scores.get(person.userId);
        return {
          userId: person.userId,
          name: person.name,
          rw: score?.rw ?? null,
          math: score?.math ?? null,
        };
      }),
    [filtered, scores],
  );

  function daysFrom(form: FormData, prefix: string) {
    return DAY_LABELS.map((_, index) =>
      form.get(`${prefix}-${index + 1}`) ? index + 1 : null,
    ).filter((day): day is number => day != null);
  }

  async function saveClass(form: FormData) {
    const mathDays = daysFrom(form, "math-day");
    const englishDays = daysFrom(form, "eng-day");
    await updateClass(classRow.id, {
      name: String(form.get("name") || classRow.name),
      description: String(form.get("description") || "") || null,
      room: String(form.get("room") || "") || null,
      level: String(form.get("level") || "") || null,
      math_schedule_days: mathDays,
      math_start_time: String(form.get("math-start") || "") || null,
      math_end_time: String(form.get("math-end") || "") || null,
      ebrw_schedule_days: englishDays,
      ebrw_start_time: String(form.get("eng-start") || "") || null,
      ebrw_end_time: String(form.get("eng-end") || "") || null,
      schedule_days: [...new Set([...mathDays, ...englishDays])],
    });
    toast.success("Class saved");
    setEditing(false);
    await onChanged();
  }

  return (
    <div className="space-y-4 text-brand-900">
      <Link
        to="/admin/classes"
        className="tap text-sm font-bold uppercase text-brand-900"
      >
        ← BACK
      </Link>
      <Panel tone="brand" className="relative overflow-hidden p-5 text-white">
        <PanelGlow />
        <div className="relative flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black uppercase text-white">{classRow.name}</h1>
            <p className="mt-1 text-sm font-bold uppercase text-white">
              {scheduleLine(
                "MATH",
                classRow.math_schedule_days ?? classRow.schedule_days,
                classRow.math_start_time ?? classRow.start_time,
                classRow.math_end_time ?? classRow.end_time,
              )}
            </p>
            <p className="text-sm font-bold uppercase text-white">
              {scheduleLine(
                "ENGLISH",
                classRow.ebrw_schedule_days ?? classRow.schedule_days,
                classRow.ebrw_start_time ?? classRow.start_time,
                classRow.ebrw_end_time ?? classRow.end_time,
              )}
            </p>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              className="btn-brand rounded-full bg-brand-400 px-3 py-1.5 text-xs font-bold uppercase text-white"
              onClick={() => setEditing(true)}
            >
              ADD MATH AND ENGLISH
            </button>
            <button
              type="button"
              className="tap rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold uppercase text-white"
              onClick={() => setEditing((value) => !value)}
            >
              EDIT CLASS
            </button>
            <button
              type="button"
              className="tap rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold uppercase text-white"
              onClick={() =>
                void updateClass(classRow.id, { active: !classRow.active }).then(onChanged)
              }
            >
              {classRow.active ? "DEACTIVATE" : "ACTIVATE"}
            </button>
            <button
              type="button"
              className="tap rounded-full bg-brand-900 px-3 py-1.5 text-xs font-bold uppercase text-white"
              onClick={() => {
                if (confirm(`Delete group "${classRow.name}"?`))
                  void deleteClass(classRow.id).then(() => onChanged());
              }}
            >
              DELETE
            </button>
          </div>
        </div>
        {editing && (
          <form
            className="relative mt-4 grid gap-2 md:grid-cols-2"
            onSubmit={(event) => {
              event.preventDefault();
              void saveClass(new FormData(event.currentTarget));
            }}
          >
            <input name="name" defaultValue={classRow.name} className={CLASS_CONTROL} />
            <input
              name="room"
              defaultValue={classRow.room ?? ""}
              placeholder="Room"
              className={CLASS_CONTROL}
            />
            <input
              name="level"
              defaultValue={classRow.level ?? ""}
              placeholder="Level"
              className={CLASS_CONTROL}
            />
            <input
              name="description"
              defaultValue={classRow.description ?? ""}
              placeholder="Description"
              className={CLASS_CONTROL}
            />
            <ScheduleFields
              title="MATH"
              prefix="math"
              days={classRow.math_schedule_days ?? classRow.schedule_days}
              start={classRow.math_start_time ?? classRow.start_time}
              end={classRow.math_end_time ?? classRow.end_time}
            />
            <ScheduleFields
              title="ENGLISH"
              prefix="eng"
              days={classRow.ebrw_schedule_days ?? classRow.schedule_days}
              start={classRow.ebrw_start_time ?? classRow.start_time}
              end={classRow.ebrw_end_time ?? classRow.end_time}
            />
            <button
              className="btn-brand w-fit rounded-full bg-brand-400 px-4 py-2 text-xs font-bold uppercase text-white"
              type="submit"
            >
              SAVE
            </button>
          </form>
        )}
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border border-brand-400/40 bg-brand-600 p-3 text-white">
          <div className="flex items-center justify-between gap-2">
            <input
              className={CLASS_CONTROL}
              placeholder="Search roster"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <button
              type="button"
              className="tap grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-brand-400"
              onClick={() => setAddOpen(true)}
              aria-label="Add student"
            >
              <UserPlus className="h-4 w-4" />
            </button>
          </div>
          <ul className="stagger mt-3 space-y-1">
            {filtered.map((person) => {
              const score = scores.get(person.userId);
              const total = score ? totalScore(score.rw, score.math) : null;
              return (
                <li key={person.userId}>
                  <Link
                    to="/admin/classes/$classId/students/$userId"
                    params={{ classId: classRow.id, userId: person.userId }}
                    className="tap flex items-center justify-between gap-2 rounded-lg px-2 py-2 hover:bg-brand-500"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{person.name}</span>
                      <span className="text-[11px] text-brand-100">{person.status}</span>
                    </span>
                    {total != null && <RankBadge letter={rankFor(total).letter} />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </aside>

        <section className="min-w-0 rounded-2xl border border-brand-400/40 bg-brand-600 p-4 text-white">
          <div className="relative mb-4 flex gap-1 overflow-x-auto rounded-lg bg-brand-800 p-1">
            <span
              className="nav-tab-pill pointer-events-none absolute bottom-1 top-1 rounded-md bg-brand-400"
              style={{
                width: `calc(${100 / TABS.length}% - 0.25rem)`,
                transform: `translateX(calc(${TABS.indexOf(tab)} * (100% + 0.25rem)))`,
              }}
            />
            {TABS.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => onNavigate({ tab: id })}
                className={
                  "relative z-10 flex-1 rounded-md px-2 py-1.5 text-xs font-bold uppercase " +
                  (tab === id ? "text-white" : "text-white/80")
                }
              >
                {id}
              </button>
            ))}
          </div>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              className="tap"
              onClick={() => onNavigate({ month: shiftMonth(month, -1) })}
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-bold">{month}</span>
            <button
              type="button"
              className="tap"
              onClick={() => onNavigate({ month: shiftMonth(month, 1) })}
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="tap ml-auto inline-flex items-center gap-1 text-xs font-bold uppercase text-white"
              onClick={() => void ensureClassLessons(classRow.id, month).then(() => load())}
            >
              <Plus className="h-3.5 w-3.5" /> GENERATE FROM SCHEDULE
            </button>
          </div>
          {loading ? (
            <ListSkeleton rows={4} />
          ) : tab === "attendance" ? (
            <AttendanceLessonGrid
              classId={classRow.id}
              lessons={lessons}
              people={filtered}
              present={present}
              absent={absent}
              onChange={load}
            />
          ) : tab === "var" ? (
            <VarLessonGrid
              classId={classRow.id}
              lessons={lessons}
              people={filtered}
              marks={marks}
              selectedLessonId={lesson || lessons[0]?.id || null}
              onSelectLesson={(id) => onNavigate({ lesson: id })}
              onChange={load}
            />
          ) : tab === "ranking" ? (
            <RankingTable students={rankRows} onSaved={load} />
          ) : tab === "homework" ? (
            <HomeworkPanel classId={classRow.id} month={month} />
          ) : (
            <ChatPanel classId={classRow.id} />
          )}
        </section>
      </div>
      <AddStudentDialog
        classId={classRow.id}
        open={addOpen}
        isAdmin={isAdmin}
        onClose={() => setAddOpen(false)}
        onAdded={load}
      />
    </div>
  );
}

function ScheduleFields({
  title,
  prefix,
  days,
  start,
  end,
}: {
  title: string;
  prefix: string;
  days?: number[] | null;
  start?: string | null;
  end?: string | null;
}) {
  const startName = prefix === "math" ? "math-start" : "eng-start";
  const endName = prefix === "math" ? "math-end" : "eng-end";
  const dayPrefix = prefix === "math" ? "math-day" : "eng-day";
  return (
    <div className="rounded-xl border border-white/20 p-3 md:col-span-2">
      <p className="text-xs font-black uppercase text-white">{title}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {DAY_LABELS.map((label, index) => (
          <label key={label} className="text-xs font-bold uppercase text-white">
            <input
              type="checkbox"
              name={`${dayPrefix}-${index + 1}`}
              defaultChecked={(days ?? []).includes(index + 1)}
              className="mr-1"
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <input name={startName} type="time" defaultValue={start ?? ""} className={CLASS_CONTROL} />
        <input name={endName} type="time" defaultValue={end ?? ""} className={CLASS_CONTROL} />
      </div>
    </div>
  );
}
