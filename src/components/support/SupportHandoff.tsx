import { useEffect, useMemo, useState } from "react";
import { Check, Plus, Search, Send, Undo2, User, Users } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { tashkentToday } from "@/lib/billing/dates";
import type { ClassSubject } from "@/lib/classes/types";
import {
  assignSupportStudent,
  clearSupportWindow,
  formatWhen,
  loadDaySheet,
  loadSendBoard,
  postSupportRange,
  setSupportTick,
  type DaySlot,
  type SendBoard,
} from "@/lib/support/api";

const BOARDS: { subject: ClassSubject; label: string }[] = [
  { subject: "ebrw", label: "English" },
  { subject: "math", label: "Math" },
];

export function SupportHandoff({ day, subject }: { day: string; subject: ClassSubject }) {
  const [board, setBoard] = useState<SendBoard>({ teachers: [], students: [] });
  const [slots, setSlots] = useState<DaySlot[]>([]);
  const [adding, setAdding] = useState<ClassSubject | null>(null);
  const [teacherId, setTeacherId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const [nextBoard, nextSlots] = await Promise.all([
      loadSendBoard(),
      day ? loadDaySheet(day) : Promise.resolve([] as DaySlot[]),
    ]);
    setBoard(nextBoard);
    setSlots(nextSlots);
  }

  useEffect(() => {
    setAdding(null);
    void load().catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not load support"));
  }, [day]);

  const students = useMemo(() => {
    const map = new Map<string, { id: string; name: string; className: string }>();
    for (const student of board.students) {
      if (!map.has(student.id)) {
        map.set(student.id, { id: student.id, name: student.name, className: student.class_name });
      }
    }
    return [...map.values()];
  }, [board.students]);

  const className = useMemo(() => new Map(students.map((student) => [student.id, student.className])), [students]);

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

  function openSlot(list: DaySlot[]) {
    return list.find(
      (slot) =>
        slot.teacher_id === teacherId &&
        !slot.student_id &&
        !slot.closed &&
        new Date(slot.starts_at).getTime() > Date.now(),
    );
  }

  async function add(subject: ClassSubject) {
    if (!teacherId || !studentId || busy) return;
    setBusy(true);
    try {
      let list = slots;
      let open = openSlot(list);
      if (!open && day) {
        await postSupportRange(`${day}T15:00`, `${day}T17:00`, teacherId);
        list = await loadDaySheet(day);
        setSlots(list);
        open = openSlot(list);
      }
      const slot = open;
      if (!slot) {
        toast.error("That teacher has no open slot on this day");
        return;
      }
      await assignSupportStudent(slot.id, studentId, subject);
      toast.success("Student added");
      setAdding(null);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add that student");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      {BOARDS.filter((column) => column.subject === subject).map((column) => (
        <SubjectBoard
          key={column.subject}
          label={column.label}
          subject={column.subject}
          past={day < tashkentToday()}
          slots={slots}
          className={className}
          adding={adding === column.subject}
          teachers={board.teachers}
          students={students}
          teacherId={teacherId}
          studentId={studentId}
          busy={busy}
          onAdd={() => {
            setAdding(column.subject);
            setTeacherId("");
            setStudentId("");
          }}
          onClose={() => setAdding(null)}
          onTeacher={setTeacherId}
          onStudent={setStudentId}
          onSave={() => void add(column.subject)}
          onClear={(windowId) => void run(() => clearSupportWindow(windowId), "Student taken off this day")}
          onAttend={(sessionId, present) =>
            void run(() => setSupportTick(sessionId, "attendance", present), present ? "Marked present" : "Marked absent")
          }
        />
      ))}
    </div>
  );
}

function SubjectBoard({
  label,
  subject,
  past,
  slots,
  className,
  adding,
  teachers,
  students,
  teacherId,
  studentId,
  busy,
  onAdd,
  onClose,
  onTeacher,
  onStudent,
  onSave,
  onClear,
  onAttend,
}: {
  label: string;
  subject: ClassSubject;
  past: boolean;
  slots: DaySlot[];
  className: Map<string, string>;
  adding: boolean;
  teachers: { id: string; name: string }[];
  students: { id: string; name: string; className: string }[];
  teacherId: string;
  studentId: string;
  busy: boolean;
  onAdd: () => void;
  onClose: () => void;
  onTeacher: (id: string) => void;
  onStudent: (id: string) => void;
  onSave: () => void;
  onClear: (windowId: string) => void;
  onAttend: (sessionId: string, present: boolean) => void;
}) {
  const rows = slots.filter((slot) => slot.student_id && slot.subject === subject);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-black">{label}</h3>
        {past ? null : (
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1 text-xs font-black text-brand-900"
            onClick={onAdd}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" /> Add
          </button>
        )}
      </div>
      {past ? null : (
      <AddWindow
        open={adding}
        label={label}
        teachers={teachers}
        students={students}
        teacherId={teacherId}
        studentId={studentId}
        busy={busy}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        onTeacher={onTeacher}
        onStudent={onStudent}
        onSave={() => {
          if (!teacherId || !studentId) {
            toast.error("Choose a teacher and a student first");
            return;
          }
          onSave();
        }}
      />
      )}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-white/30 text-xs">
              <th className="px-2 py-2">Time</th>
              <th className="px-2 py-2">Student</th>
              <th className="px-2 py-2">Class</th>
              <th className="px-2 py-2">Teacher</th>
              <th className="px-2 py-2">Attendance</th>
              {past ? null : <th className="px-2 py-2" />}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={past ? 5 : 6} className="fade-in px-2 py-3 text-sm">
                  No one is on {label} support this day.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b border-white/15">
                  <td className="px-2 py-2 whitespace-nowrap">{formatWhen(row.starts_at).slice(-5)}</td>
                  <td className="px-2 py-2 font-bold">{row.student_name}</td>
                  <td className="px-2 py-2">{className.get(row.student_id ?? "") || "—"}</td>
                  <td className="px-2 py-2">{row.teacher_name}</td>
                  <td className="px-2 py-2">
                    <AttendanceTick
                      on={row.attended}
                      label={`Attendance for ${row.student_name ?? "this student"}`}
                      disabled={busy || !row.session_id}
                      onClick={() => {
                        if (!row.session_id) return;
                        const next = row.attended !== true;
                        onAttend(row.session_id, next);
                      }}
                    />
                  </td>
                  {past ? null : (
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="inline-flex items-center gap-1 text-xs font-bold underline"
                        onClick={() => onClear(row.id)}
                      >
                        <Undo2 className="h-3 w-3" aria-hidden="true" /> Take off
                      </button>
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

function AddWindow({
  open,
  label,
  teachers,
  students,
  teacherId,
  studentId,
  busy,
  onOpenChange,
  onTeacher,
  onStudent,
  onSave,
}: {
  open: boolean;
  label: string;
  teachers: { id: string; name: string }[];
  students: { id: string; name: string; className: string }[];
  teacherId: string;
  studentId: string;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onTeacher: (id: string) => void;
  onStudent: (id: string) => void;
  onSave: () => void;
}) {
  const [teacherQuery, setTeacherQuery] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [group, setGroup] = useState("");
  const groups = useMemo(() => {
    const names = new Set<string>();
    for (const student of students) {
      for (const token of groupTokens(student.className)) names.add(token);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [students]);
  const teacherList = teachers.filter((teacher) =>
    teacher.name.toLowerCase().includes(teacherQuery.trim().toLowerCase()),
  );
  const studentList = students.filter((student) => {
    const queryOk = student.name.toLowerCase().includes(studentQuery.trim().toLowerCase());
    const groupOk = !group || groupTokens(student.className).includes(group);
    return queryOk && groupOk;
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-brand-600 text-white [&>button]:text-white sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-white">Add to {label}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <section className="space-y-2">
            <p className="text-xs font-black">Teacher</p>
            <SearchField
              label="Search teachers"
              value={teacherQuery}
              onChange={setTeacherQuery}
              placeholder="Search teachers"
            />
            <ul className="max-h-52 space-y-1 overflow-y-auto" role="listbox" aria-label="Teachers">
              {teacherList.length === 0 ? (
                <li className="px-2 py-2 text-xs">No teachers match.</li>
              ) : (
                teacherList.map((teacher) => (
                  <li key={teacher.id}>
                    <PickRow
                      selected={teacher.id === teacherId}
                      title={teacher.name}
                      onClick={() => onTeacher(teacher.id)}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
          <section className="space-y-2">
            <p className="text-xs font-black">Student</p>
            <SearchField
              label="Search students"
              value={studentQuery}
              onChange={setStudentQuery}
              placeholder="Search students"
            />
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
            <ul className="max-h-52 space-y-1 overflow-y-auto" role="listbox" aria-label="Students">
              {studentList.length === 0 ? (
                <li className="px-2 py-2 text-xs">No students match.</li>
              ) : (
                studentList.map((student) => (
                  <li key={student.id}>
                    <PickRow
                      selected={student.id === studentId}
                      title={student.name}
                      detail={student.className}
                      onClick={() => onStudent(student.id)}
                    />
                  </li>
                ))
              )}
            </ul>
          </section>
        </div>
        <button
          type="button"
          disabled={busy}
          className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-sm font-black text-brand-900 disabled:opacity-40"
          onClick={onSave}
        >
          <Send className="h-3.5 w-3.5" aria-hidden="true" /> Place
        </button>
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
  onClick,
}: {
  selected: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-1 rounded-lg px-2 py-1.5 text-left text-xs ${
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
