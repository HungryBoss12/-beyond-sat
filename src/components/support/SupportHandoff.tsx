import { useEffect, useMemo, useState } from "react";
import { Check, Search, Undo2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tashkentToday } from "@/lib/billing/dates";
import type { ClassSubject } from "@/lib/classes/types";
import {
  assignSupportStudent,
  clearSupportWindow,
  loadDaySheet,
  loadReceivedStudents,
  loadSendBoard,
  postSupportRange,
  setSupportTask,
  setSupportTick,
  setWindowNote,
  subjectLabel,
  type DaySlot,
  type SendBoard,
} from "@/lib/support/api";

const BOARDS: { subject: ClassSubject; label: string }[] = [
  { subject: "ebrw", label: "English" },
  { subject: "math", label: "Math" },
];

type PickTarget = {
  startsAt: string;
  endsAt: string;
  subject: ClassSubject;
  kind: "teacher" | "student";
  window: DaySlot | null;
};

type SlotRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  window: DaySlot | null;
  note: string;
};

function clock(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Tashkent",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}

function rowsFor(
  subject: ClassSubject,
  slots: DaySlot[],
  past: boolean,
  picked: Record<string, string>,
  allowed: Set<string> | null,
  own: boolean,
): SlotRow[] {
  const open = slots.filter((slot) => !slot.closed);
  if (own) {
    return open
      .filter((slot) => !past || slot.student_id)
      .map((window) => ({
        id: window.id,
        startsAt: window.starts_at,
        endsAt: window.ends_at,
        window,
        note: window.task || window.note || "",
      }));
  }
  const filled = open.filter((slot) => slot.student_id && slot.subject === subject);
  const filledStarts = new Set(filled.map((slot) => slot.starts_at));
  const freeStarts = new Map<string, DaySlot>();
  if (!past) {
    for (const slot of open) {
      if (slot.student_id || filledStarts.has(slot.starts_at) || freeStarts.has(slot.starts_at)) continue;
      if (allowed && !allowed.has(slot.teacher_id)) continue;
      freeStarts.set(slot.starts_at, slot);
    }
  }
  const rows: SlotRow[] = [
    ...filled.map((window) => ({
      id: window.id,
      startsAt: window.starts_at,
      endsAt: window.ends_at,
      window,
      note: window.task || window.note || "",
    })),
    ...[...freeStarts.values()].map((slot) => {
      const teacherId = picked[`${subject}:${slot.starts_at}`];
      const sameTime = open.filter((item) => item.starts_at === slot.starts_at && !item.student_id);
      const window = sameTime.find((item) => item.teacher_id === teacherId) ?? null;
      const noted = window?.note || sameTime.find((item) => item.note)?.note || "";
      return {
        id: window?.id ?? `free:${slot.starts_at}`,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        window,
        note: window?.task || noted,
      };
    }),
  ];
  return rows.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function SupportHandoff({ day, selfSubject }: { day: string; selfSubject?: ClassSubject }) {
  const own = selfSubject != null;
  const [board, setBoard] = useState<SendBoard>({ teachers: [], students: [] });
  const [received, setReceived] = useState<{ id: string; name: string; className: string }[]>([]);
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [picker, setPicker] = useState<PickTarget | null>(null);
  const [pickedTeacher, setPickedTeacher] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const past = day < tashkentToday();

  async function load() {
    if (own) {
      const [nextSlots, sent] = await Promise.all([
        day ? loadDaySheet(day) : Promise.resolve([] as DaySlot[]),
        loadReceivedStudents(),
      ]);
      setSlots(nextSlots);
      setReceived(
        sent
          .filter((student) => student.subject === selfSubject)
          .map((student) => ({ id: student.id, name: student.name, className: student.class_name })),
      );
      return;
    }
    const [nextBoard, nextSlots] = await Promise.all([
      loadSendBoard(),
      day ? loadDaySheet(day) : Promise.resolve([] as DaySlot[]),
    ]);
    setBoard(nextBoard);
    setSlots(nextSlots);
  }

  useEffect(() => {
    setPicker(null);
    setPickedTeacher({});
    void load().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load support"));
  }, [day, selfSubject]);

  const students = useMemo(() => {
    if (own) return received;
    const map = new Map<string, { id: string; name: string; className: string }>();
    for (const student of board.students) {
      if (!map.has(student.id)) {
        map.set(student.id, { id: student.id, name: student.name, className: student.class_name });
      }
    }
    return [...map.values()];
  }, [board.students, own, received]);

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update");
    } finally {
      setBusy(false);
    }
  }

  async function chooseTeacher(target: PickTarget, teacherId: string) {
    if (busy) return;
    if (target.window?.student_id && target.window.teacher_id !== teacherId) {
      toast.error("Take the student off before changing the teacher");
      return;
    }
    const chosen = board.teachers.find((teacher) => teacher.id === teacherId);
    if (!chosen || chosen.subject !== target.subject) {
      toast.error("That teacher does not teach this subject");
      return;
    }
    const existing = slots.find(
      (item) => item.teacher_id === teacherId && item.starts_at === target.startsAt && !item.closed && !item.student_id,
    );
    const taken = slots.find(
      (item) => item.teacher_id === teacherId && item.starts_at === target.startsAt && item.student_id && item.subject !== target.subject,
    );
    if (taken) {
      toast.error("That teacher is already booked at this time");
      return;
    }
    setBusy(true);
    try {
      if (!existing) {
        await postSupportRange(`${day}T${clock(target.startsAt)}`, `${day}T${clock(target.endsAt)}`, teacherId);
        await load();
      }
      setPickedTeacher((current) => ({ ...current, [`${target.subject}:${target.startsAt}`]: teacherId }));
      setPicker(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set that teacher");
    } finally {
      setBusy(false);
    }
  }

  async function chooseStudent(target: PickTarget, studentId: string) {
    if (busy) return;
    const windowId =
      target.window?.id ??
      slots.find(
        (item) =>
          item.teacher_id === pickedTeacher[`${target.subject}:${target.startsAt}`] &&
          item.starts_at === target.startsAt &&
          !item.student_id &&
          !item.closed,
      )?.id;
    if (!windowId) {
      toast.error("Choose a teacher first");
      return;
    }
    if (target.window?.student_id) {
      toast.error("Take this student off before choosing another");
      return;
    }
    setBusy(true);
    try {
      const noted = slots.find((item) => item.id === windowId)?.note ?? "";
      await assignSupportStudent(windowId, studentId, target.subject);
      if (noted) await setWindowNote(windowId, noted);
      toast.success("Student added");
      setPicker(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that student");
    } finally {
      setBusy(false);
    }
  }

  async function saveNote(row: SlotRow, text: string, subject: ClassSubject) {
    const teaching = new Set(
      board.teachers.filter((teacher) => teacher.subject === subject).map((teacher) => teacher.id),
    );
    const targets = row.window
      ? [row.window]
      : slots.filter(
          (item) =>
            item.starts_at === row.startsAt &&
            !item.closed &&
            !item.student_id &&
            (own || teaching.has(item.teacher_id)),
        );
    if (targets.length === 0) {
      toast.error("Open this time before writing a note");
      return;
    }
    setBusy(true);
    try {
      await Promise.all(targets.map((item) => setWindowNote(item.id, text)));
      if (row.window?.session_id) await setSupportTask(row.window.session_id, text);
      toast.success("Notes saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save the note");
    } finally {
      setBusy(false);
    }
  }

  const boards = own ? BOARDS.filter((column) => column.subject === selfSubject) : BOARDS;

  return (
    <div className="space-y-4">
      {boards.map((column) => {
        const allowed = new Set(
          board.teachers.filter((teacher) => teacher.subject === column.subject).map((teacher) => teacher.id),
        );
        return (
        <SubjectBoard
          key={column.subject}
          label={column.label}
          past={past}
          lockTeacher={own}
          rows={rowsFor(column.subject, slots, past, pickedTeacher, own ? null : allowed, own)}
          busy={busy}
          onTeacher={(row) =>
            setPicker({
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              subject: column.subject,
              kind: "teacher",
              window: row.window,
            })
          }
          onStudent={(row) => {
            if (!own && !row.window?.teacher_id) {
              toast.error("Choose a teacher first");
              return;
            }
            setPicker({
              startsAt: row.startsAt,
              endsAt: row.endsAt,
              subject: column.subject,
              kind: "student",
              window: row.window,
            });
          }}
          onClear={(windowId) => void run(() => clearSupportWindow(windowId), "Student taken off this day")}
          onAttend={(sessionId, present) =>
            void run(() => setSupportTick(sessionId, "attendance", present), present ? "Marked present" : "Marked absent")
          }
          onNotes={(row, text) => void saveNote(row, text, column.subject)}
        />
        );
      })}
      {picker?.kind === "teacher" && !own ? (
        <TeacherWindow
          key={`${picker.subject}:${picker.startsAt}`}
          open
          teachers={board.teachers.filter((teacher) => teacher.subject === picker.subject)}
          teacherId={picker.window?.teacher_id ?? pickedTeacher[`${picker.subject}:${picker.startsAt}`] ?? ""}
          busy={busy}
          onOpenChange={(next) => {
            if (!next) setPicker(null);
          }}
          onPick={(teacherId) => void chooseTeacher(picker, teacherId)}
        />
      ) : null}
      {picker?.kind === "student" ? (
        <StudentWindow
          key={`${picker.subject}:${picker.startsAt}:student`}
          open
          students={students}
          studentId={picker.window?.student_id ?? ""}
          busy={busy}
          onOpenChange={(next) => {
            if (!next) setPicker(null);
          }}
          onPick={(studentId) => void chooseStudent(picker, studentId)}
        />
      ) : null}
    </div>
  );
}

function SubjectBoard({
  label,
  past,
  lockTeacher,
  rows,
  busy,
  onTeacher,
  onStudent,
  onClear,
  onAttend,
  onNotes,
}: {
  label: string;
  past: boolean;
  lockTeacher?: boolean;
  rows: SlotRow[];
  busy: boolean;
  onTeacher: (row: SlotRow) => void;
  onStudent: (row: SlotRow) => void;
  onClear: (windowId: string) => void;
  onAttend: (sessionId: string, present: boolean) => void;
  onNotes: (row: SlotRow, text: string) => void;
}) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-black">{label}</h3>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/30 text-xs">
              <th className="px-2 py-2">No</th>
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Teacher</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Notes</th>
              <th className="px-2 py-2">Attendance</th>
              {past ? null : <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={past ? 6 : 7} className="fade-in px-2 py-3 text-sm">
                  {past ? "No one is booked this day." : "No slots opened for this day."}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={row.id} className="border-b border-white/15">
                  <td className="px-2 py-2">{index + 1}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{`${clock(row.startsAt)}–${clock(row.endsAt)}`}</td>
                  <td className="px-2 py-2">
                    {past || lockTeacher ? (
                      row.window?.teacher_name
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onTeacher(row)}
                        className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-brand-900"
                      >
                        <User className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{row.window?.teacher_name || "Choose teacher"}</span>
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    {past ? (
                      row.window?.student_name
                    ) : (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onStudent(row)}
                        className="inline-flex max-w-[12rem] items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold text-brand-900"
                      >
                        <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
                        <span className="truncate">{row.window?.student_name || "Choose student"}</span>
                      </button>
                    )}
                  </td>
                  <td className="px-2 py-2">
                    <NotesField
                      value={row.note}
                      busy={busy}
                      onSave={(text) => onNotes(row, text)}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <AttendanceTick
                      on={row.window?.attended ?? null}
                      label={`Attendance for ${row.window?.student_name ?? "this student"}`}
                      disabled={busy || !row.window?.session_id}
                      onClick={() => {
                        if (!row.window?.session_id) return;
                        onAttend(row.window.session_id, row.window.attended !== true);
                      }}
                    />
                  </td>
                  {past ? null : (
                    <td className="px-2 py-2">
                      {row.window?.student_id ? (
                        <button
                          type="button"
                          disabled={busy}
                          className="inline-flex items-center gap-1 text-xs font-bold underline"
                          onClick={() => onClear(row.window!.id)}
                        >
                          <Undo2 className="h-3 w-3" aria-hidden="true" /> Take off
                        </button>
                      ) : null}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotesField({
  value,
  busy,
  onSave,
}: {
  value: string;
  busy: boolean;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => {
    setText(value);
  }, [value]);
  return (
    <input
      value={text}
      disabled={busy}
      placeholder="Write a note"
      aria-label="Notes"
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        const next = text.trim();
        if (next === value.trim()) return;
        onSave(next);
      }}
      className="w-full min-w-[9rem] rounded-lg border border-white/40 bg-white px-2 py-1 text-xs text-brand-900 outline-none placeholder:text-brand-900/40"
    />
  );
}

function AttendanceTick({
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
        on === true ? "bg-white text-brand-900" : on === false ? "bg-red-500 text-white" : "bg-brand-800 text-white ring-1 ring-white/40"
      }`}
    >
      {on === true ? <Check className="h-4 w-4" aria-hidden="true" /> : on === false ? "×" : ""}
    </button>
  );
}

function groupTokens(className: string): string[] {
  return className
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function TeacherWindow({
  open,
  teachers,
  teacherId,
  busy,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  teachers: { id: string; name: string; subject: ClassSubject | null }[];
  teacherId: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const list = teachers.filter((teacher) => teacher.name.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-brand-600 text-white [&>button]:text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">All teachers</DialogTitle>
        </DialogHeader>
        <SearchField label="Search teachers" value={query} onChange={setQuery} placeholder="Search teachers" />
        <ul className="max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Teachers">
          {list.length === 0 ? (
            <li className="px-2 py-2 text-xs">No teachers match.</li>
          ) : (
            list.map((teacher) => (
              <li key={teacher.id}>
                <PickRow
                  selected={teacher.id === teacherId}
                  title={teacher.subject ? `${teacher.name} · ${subjectLabel(teacher.subject)}` : teacher.name}
                  disabled={busy}
                  onClick={() => onPick(teacher.id)}
                />
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function StudentWindow({
  open,
  students,
  studentId,
  busy,
  onOpenChange,
  onPick,
}: {
  open: boolean;
  students: { id: string; name: string; className: string }[];
  studentId: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const student of students) {
      for (const token of groupTokens(student.className)) names.add(token);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [students]);
  const list = students.filter((student) => {
    const queryOk = student.name.toLowerCase().includes(query.trim().toLowerCase());
    const groupOk = !group || groupTokens(student.className).includes(group);
    return queryOk && groupOk;
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-brand-600 text-white [&>button]:text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">All students</DialogTitle>
        </DialogHeader>
        <SearchField label="Search students" value={query} onChange={setQuery} placeholder="Search students" />
        <div className="flex gap-1 overflow-x-auto" role="group" aria-label="Group">
          <FilterChip active={group === ""} onClick={() => setGroup("")}>
            All groups
          </FilterChip>
          {groups.map((name) => (
            <FilterChip key={name} active={group === name} onClick={() => setGroup(name)}>
              {name}
            </FilterChip>
          ))}
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto" role="listbox" aria-label="Students">
          {list.length === 0 ? (
            <li className="px-2 py-2 text-xs">No students match.</li>
          ) : (
            list.map((student) => (
              <li key={student.id}>
                <PickRow
                  selected={student.id === studentId}
                  title={student.name}
                  detail={student.className}
                  disabled={busy}
                  onClick={() => onPick(student.id)}
                />
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}

function SearchField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="flex items-center gap-1 rounded-lg bg-brand-800 px-2 py-1.5">
      <Search className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="w-full bg-transparent text-xs outline-none"
      />
    </label>
  );
}

function PickRow({
  selected,
  title,
  detail,
  disabled,
  onClick,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      disabled={disabled}
      onClick={onClick}
      className={`flex w-full items-start gap-1 rounded-lg px-2 py-1.5 text-left text-xs disabled:opacity-40 ${
        selected ? "bg-white text-brand-900" : "bg-brand-800 hover:bg-brand-700"
      }`}
    >
      <User className="mt-0.5 h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate font-bold">{title}</span>
        {detail ? <span className="block truncate opacity-70">{detail}</span> : null}
      </span>
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        active ? "bg-white text-brand-900" : "bg-brand-900 text-white"
      }`}
    >
      <Users className="h-3 w-3" aria-hidden="true" />
      {children}
    </button>
  );
}
