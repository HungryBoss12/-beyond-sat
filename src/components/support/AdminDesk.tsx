import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { SupportHandoff } from "@/components/support/SupportHandoff";
import { BookOpen, Calculator, CalendarClock, Check, ChevronLeft, ChevronRight, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import type { ClassSubject } from "@/lib/classes/types";
import {
  DUTY_LABEL,
  formatWhen,
  loadAdminTeachers,
  loadStudentBookingOn,
  postSupportRange,
  saveStudentBookingOn,
  setSupportSubject,
  subjectLabel,
  tashkentCalendarToday,
  type DutyStatus,
  type SupportTeacherCard,
} from "@/lib/support/api";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function startOfWeek(anchor: Date): Date {
  const day = new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate());
  const pad = (day.getDay() + 6) % 7;
  day.setDate(day.getDate() - pad);
  return day;
}

function shiftWeek(monday: Date, weeks: number): Date {
  const next = new Date(monday);
  next.setDate(monday.getDate() + weeks * 7);
  return next;
}

function addDays(day: Date, count: number): Date {
  const next = new Date(day);
  next.setDate(day.getDate() + count);
  return next;
}

function monthGrid(anchor: Date): Date[] {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startPad = (first.getDay() + 6) % 7;
  const cursor = new Date(first);
  cursor.setDate(1 - startPad);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(cursor);
    day.setDate(cursor.getDate() + index);
    return day;
  });
}

function weekdayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function dayKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

export function AdminDesk() {
  const [teachers, setTeachers] = useState<SupportTeacherCard[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupTick, setSetupTick] = useState(0);
  const [week, setWeek] = useState(() => startOfWeek(tashkentCalendarToday()));
  const [pickedDays, setPickedDays] = useState<boolean[]>(() => [true, true, true, true, true, true, false]);
  const [fromTime, setFromTime] = useState("15:00");
  const [toTime, setToTime] = useState("19:00");
  const [openEnglish, setOpenEnglish] = useState(true);
  const [openMath, setOpenMath] = useState(true);
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bookingOn, setBookingOn] = useState(false);
  const [slotNote, setSlotNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setTeachers(await loadAdminTeachers());
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load teachers"));
    void loadStudentBookingOn()
      .then(setBookingOn)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load booking"));
  }, []);

  const days = useMemo(() => monthGrid(month), [month]);

  useEffect(() => {
    if (!day) return;
    const [year, monthPart, datePart] = day.split("-").map(Number);
    const chosen = new Date(year, (monthPart ?? 1) - 1, datePart ?? 1);
    if (!pickedDays[weekdayIndex(chosen)]) setDay(null);
  }, [day, pickedDays]);

  async function openWeek() {
    const monday = startOfWeek(week);
    const chosen = pickedDays.flatMap((on, index) => (on ? [index] : []));
    if (chosen.length === 0) {
      setSlotNote("Choose at least one weekday");
      return;
    }
    const start = fromTime.slice(0, 5);
    const end = toTime.slice(0, 5);
    if (end <= start) {
      setSlotNote("Choose an end time later than the start");
      return;
    }
    const wanted = new Set<ClassSubject>();
    if (openEnglish) wanted.add("ebrw");
    if (openMath) wanted.add("math");
    if (wanted.size === 0) {
      setSlotNote("Choose English or Math");
      return;
    }
    const matched = teachers.filter((teacher) => teacher.subject && wanted.has(teacher.subject));
    const skipped = teachers.filter((teacher) => !teacher.subject);
    if (matched.length === 0) {
      setSlotNote(
        skipped.length > 0
          ? `${skipped.map((teacher) => teacher.name).join(", ")} still need a subject`
          : "No support teacher teaches the subject you chose",
      );
      return;
    }
    setBusy(true);
    setSlotNote(null);
    try {
      let added = 0;
      for (const teacher of matched) {
        for (const index of chosen) {
          const date = new Date(monday);
          date.setDate(monday.getDate() + index);
          added += await postSupportRange(`${dayKey(date)}T${start}`, `${dayKey(date)}T${end}`, teacher.id);
        }
      }
      const opened = added > 0 ? `${added} slots opened` : "Those slots were already open";
      const note =
        skipped.length > 0
          ? `${opened}. ${skipped.map((teacher) => teacher.name).join(", ")} still need a subject`
          : opened;
      setSlotNote(note);
      toast.success(note);
      await load();
    } catch (err) {
      const note = err instanceof Error ? err.message : "Could not open slots";
      setSlotNote(note);
      toast.error(note);
    } finally {
      setBusy(false);
    }
  }

  async function toggleBooking() {
    const next = !bookingOn;
    setBusy(true);
    try {
      await saveStudentBookingOn(next);
      setBookingOn(next);
      const note = next ? "Student booking is on" : "Student booking is off";
      setSlotNote(note);
      toast.success(note);
    } catch (err) {
      const note = err instanceof Error ? err.message : "Could not change booking";
      setSlotNote(note);
      toast.error(note);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="widen-in flex h-11 shrink-0 items-center gap-1.5 rounded-xl bg-brand-600 px-3 text-sm font-black text-white shadow-panel"
          onClick={() =>
            setSetupOpen((open) => {
              if (!open) setSetupTick((tick) => tick + 1);
              return !open;
            })
          }
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
          Setup
        </button>
        <h1 className="text-2xl font-black text-brand-900">Support teachers</h1>
      </div>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      {slotNote ? (
        <p className="rounded-xl bg-white px-4 py-3 text-sm font-black text-brand-900 shadow-panel">{slotNote}</p>
      ) : null}
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          setupOpen ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className={`min-h-0 ${setupOpen ? "overflow-visible" : "overflow-hidden"}`}>
        <Panel key={setupTick} className="widen-in space-y-4 p-4 text-sm">
          <div className="space-y-3">
            <div className="grid grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
              <button
                type="button"
                aria-label="Previous week"
                className="grid h-8 w-8 place-items-center rounded-full bg-brand-800"
                onClick={() => setWeek(shiftWeek(week, -1))}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              <p className="truncate text-center text-xs font-black">
                {week.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                {" – "}
                {addDays(week, 6).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
              <button
                type="button"
                aria-label="Next week"
                className="grid h-8 w-8 place-items-center rounded-full bg-brand-800"
                onClick={() => setWeek(shiftWeek(week, 1))}
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Weekdays">
              {WEEKDAYS.map((name, index) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={pickedDays[index]}
                  onClick={() =>
                    setPickedDays((current) => current.map((on, item) => (item === index ? !on : on)))
                  }
                  className={`inline-flex items-center justify-center gap-0.5 rounded-lg py-2 text-[11px] font-black whitespace-nowrap ${
                    pickedDays[index] ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                  }`}
                >
                  <Check className={`h-3 w-3 ${pickedDays[index] ? "" : "opacity-0"}`} aria-hidden="true" />
                  {name}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs font-bold">
                From
                <input
                  type="time"
                  value={fromTime}
                  onChange={(event) => setFromTime(event.target.value)}
                  className="mt-1 block w-full rounded-xl bg-brand-800 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-xs font-bold">
                To
                <input
                  type="time"
                  value={toTime}
                  onChange={(event) => setToTime(event.target.value)}
                  className="mt-1 block w-full rounded-xl bg-brand-800 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="Subjects to open">
              <button
                type="button"
                aria-pressed={openEnglish}
                onClick={() => setOpenEnglish((on) => !on)}
                className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-black ${
                  openEnglish ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                }`}
              >
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> English
              </button>
              <button
                type="button"
                aria-pressed={openMath}
                onClick={() => setOpenMath((on) => !on)}
                className={`inline-flex items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-black ${
                  openMath ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                }`}
              >
                <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Math
              </button>
            </div>
            <button
              type="button"
              disabled={busy}
              aria-pressed={bookingOn}
              onClick={() => void toggleBooking()}
              className={`inline-flex w-full items-center justify-center gap-1 rounded-full px-3 py-2 text-xs font-black ${
                bookingOn ? "bg-white text-brand-900" : "bg-brand-800 text-white"
              }`}
            >
              {bookingOn ? (
                <ToggleRight className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <ToggleLeft className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Student booking {bookingOn ? "on" : "off"}
            </button>
            <button
              type="button"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-brand-900"
              onClick={() => void openWeek()}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> {busy ? "Opening slots…" : "Open slots"}
            </button>
          </div>
        </Panel>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {teachers.length === 0 ? (
          <p className="text-sm">No support teachers yet. Assign the support teacher role on a user first.</p>
        ) : (
          teachers.map((teacher) => (
            <Panel key={teacher.id} className="space-y-2 p-4">
              <span className="block text-lg font-black">{teacher.name}</span>
              <span className="text-xs font-bold">
                {teacher.subject ? subjectLabel(teacher.subject) : "No subject"}
                {" · "}
                {DUTY_LABEL[teacher.status as DutyStatus] ?? teacher.status}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={teacher.subject === "ebrw"}
                  onClick={() =>
                    void setSupportSubject(teacher.id, "ebrw")
                      .then(load)
                      .then(() => toast.success(`${teacher.name} teaches English`))
                      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not set the subject"))
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                    teacher.subject === "ebrw" ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                  }`}
                >
                  <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> English
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={teacher.subject === "math"}
                  onClick={() =>
                    void setSupportSubject(teacher.id, "math")
                      .then(load)
                      .then(() => toast.success(`${teacher.name} teaches Math`))
                      .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not set the subject"))
                  }
                  className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-black ${
                    teacher.subject === "math" ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                  }`}
                >
                  <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Math
                </button>
              </div>
              <span className="mt-1 block text-xs">
                {teacher.done_count} done · {teacher.planned_count} planned
                {teacher.duty_ends_at ? ` · on duty until ${formatWhen(teacher.duty_ends_at)}` : ""}
              </span>
            </Panel>
          ))
        )}
      </div>

      <Panel className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" /> Previous
          </button>
          <h2 className="text-sm font-black">
            {month.toLocaleString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-bold">
          {WEEKDAYS.map((name) => (
            <div key={name}>{name}</div>
          ))}
          {days.map((date) => {
            const key = dayKey(date);
            const inMonth = date.getMonth() === month.getMonth();
            const scheduled = pickedDays[weekdayIndex(date)];
            return (
              <button
                key={key}
                type="button"
                disabled={!scheduled}
                onClick={() => {
                  if (!scheduled) return;
                  setDay(key);
                }}
                className={`rounded-lg py-2 ${
                  !scheduled
                    ? "cursor-not-allowed bg-white/10 text-white/35"
                    : day === key
                      ? "bg-white text-brand-900"
                      : "bg-brand-800"
                } ${inMonth || !scheduled ? "" : "opacity-40"}`}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
        <div
          className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
            day ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className={`min-h-0 ${day ? "overflow-visible" : "overflow-hidden"}`}>
          <div key={day ?? "none"} className={day ? "widen-in" : undefined}>
          <h3 className="text-sm font-black">{day}</h3>
          {day ? (
            <div key={day} className="widen-in mt-2">
              <SupportHandoff day={day} />
            </div>
          ) : null}
          </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
