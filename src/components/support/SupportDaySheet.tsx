import { useEffect, useState } from "react";
import { Check, ClipboardCheck, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import type { ClassSubject } from "@/lib/classes/types";
import {
  assignSupportStudent,
  clearSupportWindow,
  formatWhen,
  loadDaySheet,
  loadGroupStudents,
  loadReceivedStudents,
  setSupportTask,
  setSupportTick,
  type DaySlot,
} from "@/lib/support/api";

function Tick({
  on,
  label,
  disabled,
  onClick,
}: {
  on: boolean | null;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={on === true}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black disabled:opacity-40 ${
        on === true
          ? "bg-white text-brand-900"
          : on === false
            ? "bg-red-500 text-white"
            : "bg-brand-800 text-white ring-1 ring-white/40"
      }`}
    >
      {on === true ? <Check className="h-4 w-4" aria-hidden="true" /> : on === false ? "×" : ""}
    </button>
  );
}

export function SupportDaySheet({
  day,
  teacherId,
  pool = "received",
}: {
  day: string;
  teacherId?: string | null;
  pool?: "received" | "groups";
}) {
  const [rows, setRows] = useState<DaySlot[]>([]);
  const [students, setStudents] = useState<
    Record<string, { id: string; name: string; subject?: ClassSubject; class_name?: string }[]>
  >({});
  const [pick, setPick] = useState<Record<string, string>>({});
  const [subject, setSubject] = useState<Record<string, ClassSubject>>({});
  const [tasks, setTasks] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const next = await loadDaySheet(day, teacherId);
    setRows(next);
    setTasks(Object.fromEntries(next.filter((row) => row.session_id).map((row) => [row.session_id as string, row.task ?? ""])));
    const teachers = [...new Set(next.map((row) => row.teacher_id))];
    if (pool === "groups") {
      const mine = await loadGroupStudents("me");
      setStudents(Object.fromEntries(teachers.map((id) => [id, mine])));
      return;
    }
    const lists = await Promise.all(
      teachers.map(async (id) => [id, await loadReceivedStudents(id)] as const),
    );
    setStudents(Object.fromEntries(lists));
  }

  useEffect(() => {
    void load().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load the day"));
  }, [day, teacherId, pool]);

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (rows.length === 0) {
    return <p className="mt-2 text-sm">No support slots on this day.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full min-w-[720px] text-left text-sm">
        <thead>
          <tr className="text-xs">
            <th className="px-2 py-2">Time</th>
            {!teacherId && <th className="px-2 py-2">Teacher</th>}
            <th className="px-2 py-2">Student</th>
            <th className="px-2 py-2">Attendance</th>
            <th className="px-2 py-2">Homework</th>
            <th className="px-2 py-2">Task</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const options = students[row.teacher_id] ?? [];
            const chosen = pick[row.id] ?? options[0]?.id ?? "";
            const picked = options.find((student) => student.id === chosen);
            const sub = subject[row.id] ?? picked?.subject ?? "ebrw";
            return (
              <tr key={row.id} className="border-t border-white/10">
                <td className="px-2 py-2 whitespace-nowrap">{formatWhen(row.starts_at).slice(-5)}</td>
                {!teacherId && <td className="px-2 py-2">{row.teacher_name}</td>}
                <td className="px-2 py-2">
                  {row.student_name ? (
                    <span className="inline-flex items-center gap-2">
                      {row.student_name}
                      {new Date(row.starts_at).getTime() > Date.now() && (
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-1 text-xs font-bold underline"
                          onClick={() => void run(() => clearSupportWindow(row.id), "Session cleared")}
                        >
                          <X className="h-3 w-3" aria-hidden="true" /> Clear
                        </button>
                      )}
                    </span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <select
                        aria-label={`Assign a student at ${formatWhen(row.starts_at)}`}
                        value={chosen}
                        onChange={(event) => setPick((cur) => ({ ...cur, [row.id]: event.target.value }))}
                        className="rounded-lg bg-brand-800 px-2 py-1 text-xs"
                      >
                        {options.length === 0 ? (
                          <option value="">{pool === "groups" ? "No group students" : "No students received"}</option>
                        ) : (
                          options.map((student) => (
                            <option key={student.id} value={student.id}>
                              {student.name}
                              {student.class_name ? ` · ${student.class_name}` : ""}
                            </option>
                          ))
                        )}
                      </select>
                      <select
                        aria-label="Subject"
                        value={sub}
                        onChange={(event) =>
                          setSubject((cur) => ({ ...cur, [row.id]: event.target.value as ClassSubject }))
                        }
                        className="rounded-lg bg-brand-800 px-2 py-1 text-xs"
                      >
                        <option value="ebrw">English</option>
                        <option value="math">Math</option>
                      </select>
                      <button
                        type="button"
                        disabled={busy || !chosen}
                        className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-black text-brand-900 disabled:opacity-40"
                        onClick={() =>
                          void run(
                            () => assignSupportStudent(row.id, chosen, sub),
                            "Student assigned",
                          )
                        }
                      >
                        <UserPlus className="h-3.5 w-3.5" aria-hidden="true" /> Assign
                      </button>
                    </div>
                  )}
                </td>
                <td className="px-2 py-2">
                  <Tick
                    on={row.attended}
                    label={`Attendance for ${row.student_name ?? "empty slot"}`}
                    disabled={busy || !row.session_id || pool === "groups"}
                    onClick={() => {
                      if (!row.session_id || pool === "groups") return;
                      const next = row.attended === true ? false : row.attended === false ? true : true;
                      void run(() => setSupportTick(row.session_id as string, "attendance", next), "Attendance saved");
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  <Tick
                    on={row.homework_done}
                    label={`Homework for ${row.student_name ?? "empty slot"}`}
                    disabled={busy || !row.session_id || pool === "groups"}
                    onClick={() => {
                      if (!row.session_id || pool === "groups") return;
                      void run(
                        () => setSupportTick(row.session_id as string, "homework", row.homework_done !== true),
                        "Homework saved",
                      );
                    }}
                  />
                </td>
                <td className="px-2 py-2">
                  {row.session_id && pool !== "groups" ? (
                    <form
                      className="flex items-center gap-1"
                      onSubmit={(event) => {
                        event.preventDefault();
                        const sessionId = row.session_id as string;
                        void run(() => setSupportTask(sessionId, tasks[sessionId] ?? ""), "Task saved");
                      }}
                    >
                      <input
                        aria-label="Task"
                        value={tasks[row.session_id] ?? ""}
                        onChange={(event) =>
                          setTasks((cur) => ({ ...cur, [row.session_id as string]: event.target.value }))
                        }
                        className="w-full min-w-40 rounded-lg bg-brand-800 px-2 py-1 text-xs"
                        placeholder="Task for the student"
                      />
                      <button type="submit" disabled={busy} className="inline-flex items-center gap-1 text-xs font-bold">
                        <ClipboardCheck className="h-3.5 w-3.5" aria-hidden="true" /> Save
                      </button>
                    </form>
                  ) : (
                    <span className="text-xs">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
