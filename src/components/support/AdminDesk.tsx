import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { SupportHandoff } from "@/components/support/SupportHandoff";
import { BookOpen, Calculator, CalendarClock, ChevronLeft, ChevronRight, Settings, Timer } from "lucide-react";
import type { ClassSubject } from "@/lib/classes/types";
import {
  DUTY_LABEL,
  ORIGIN_LABEL,
  formatWhen,
  loadAdminTeachers,
  loadTeacherDetail,
  postSupportRange,
  setSupportDuty,
  tashkentCalendarToday,
  type DutyStatus,
  type SupportTeacherCard,
  type TeacherDetail,
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

function dayKey(day: Date): string {
  const month = String(day.getMonth() + 1).padStart(2, "0");
  const date = String(day.getDate()).padStart(2, "0");
  return `${day.getFullYear()}-${month}-${date}`;
}

export function AdminDesk() {
  const [teachers, setTeachers] = useState<SupportTeacherCard[]>([]);
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupTick, setSetupTick] = useState(0);
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [dutyMinutes, setDutyMinutes] = useState("180");
  const [week, setWeek] = useState(() => startOfWeek(tashkentCalendarToday()));
  const [pickedDays, setPickedDays] = useState<boolean[]>(() => Array(7).fill(false));
  const [fromTime, setFromTime] = useState("15:00");
  const [toTime, setToTime] = useState("17:00");
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string | null>(null);
  const [subject, setSubject] = useState<ClassSubject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setTeachers(await loadAdminTeachers());
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load teachers"));
  }, []);

  useEffect(() => {
    if (!teacherId && teachers[0]) setTeacherId(teachers[0].id);
  }, [teacherId, teachers]);

  useEffect(() => {
    if (!setupOpen || !teacherId) {
      setDetail(null);
      return;
    }
    let cancel = false;
    setDetail(null);
    void loadTeacherDetail(teacherId)
      .then((next) => {
        if (!cancel) setDetail(next);
      })
      .catch((err: unknown) => {
        if (!cancel) setError(err instanceof Error ? err.message : "Could not load that teacher");
      });
    return () => {
      cancel = true;
    };
  }, [setupOpen, teacherId]);

  const days = useMemo(() => monthGrid(month), [month]);

  async function openWeek(teacherId: string) {
    const monday = startOfWeek(week);
    const chosen = pickedDays.flatMap((on, index) => (on ? [index] : []));
    if (chosen.length === 0) {
      toast.error("Choose at least one weekday");
      return;
    }
    if (toTime <= fromTime) {
      toast.error("Choose an end time later than the start");
      return;
    }
    setBusy(true);
    try {
      let added = 0;
      for (const index of chosen) {
        const date = new Date(monday);
        date.setDate(monday.getDate() + index);
        added += await postSupportRange(`${dayKey(date)}T${fromTime}`, `${dayKey(date)}T${toTime}`, teacherId);
      }
      toast.success(added > 0 ? `${added} slots opened` : "Those slots were already open");
      setDetail(await loadTeacherDetail(teacherId));
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not open slots");
    } finally {
      setBusy(false);
    }
  }

  async function saveDuty(teacherId: string) {
    const minutes = Number(dutyMinutes);
    if (!Number.isInteger(minutes) || minutes < 15 || minutes > 14 * 60) {
      toast.error("Duty must be between 15 minutes and 14 hours");
      return;
    }
    setBusy(true);
    try {
      await setSupportDuty(teacherId, minutes);
      toast.success("Duty timer set");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not set the timer");
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
      <div
        className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          setupOpen && teacherId ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
      {teacherId ? (
        <Panel key={setupTick} className="widen-in space-y-4 p-4 text-sm">
          <label className="block text-xs font-bold">
            Teacher
            <select
              value={teacherId}
              onChange={(event) => setTeacherId(event.target.value)}
              className="mt-1 block w-full rounded-xl bg-brand-800 px-3 py-2 text-sm"
            >
              {teachers.map((teacher) => (
                <option key={teacher.id} value={teacher.id}>
                  {teacher.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="min-w-0 flex-1 text-xs font-bold">
              On duty for minutes
              <input
                type="number"
                min={15}
                max={840}
                value={dutyMinutes}
                onChange={(event) => setDutyMinutes(event.target.value)}
                className="mt-1 block w-full rounded-xl bg-brand-800 px-3 py-2 text-sm"
              />
            </label>
            <button
              type="button"
              disabled={busy}
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900"
              onClick={() => void saveDuty(teacherId)}
            >
              <Timer className="h-4 w-4" aria-hidden="true" /> Set timer
            </button>
          </div>
          <div className="space-y-3 border-t border-white/10 pt-3">
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
                <label
                  key={name}
                  className={`cursor-pointer rounded-lg py-2 text-center text-[11px] font-black whitespace-nowrap ${
                    pickedDays[index] ? "bg-white text-brand-900" : "bg-brand-800 text-white"
                  }`}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={pickedDays[index]}
                    onChange={() =>
                      setPickedDays((current) => current.map((on, item) => (item === index ? !on : on)))
                    }
                  />
                  {name}
                </label>
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
            <button
              type="button"
              disabled={busy}
              className="inline-flex w-full items-center justify-center gap-1 rounded-full bg-white px-3 py-2 text-xs font-black text-brand-900"
              onClick={() => void openWeek(teacherId)}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" /> Open slots
            </button>
          </div>
          {detail ? (
            <div key={teacherId} className="widen-in grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <div className="min-w-0">
                <p className="text-xs font-bold">Planned</p>
                {detail.planned.length === 0 ? (
                  <p className="text-xs">None.</p>
                ) : (
                  <ul>
                    {detail.planned.map((session) => (
                      <li key={session.id}>
                        {formatWhen(session.starts_at)} · {session.student_name} · {ORIGIN_LABEL[session.origin]}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold">Done</p>
                {detail.done.length === 0 ? (
                  <p className="text-xs">None.</p>
                ) : (
                  <ul>
                    {detail.done.map((session) => (
                      <li key={session.id}>
                        {formatWhen(session.starts_at)} · {session.student_name}
                        {session.attended ? " · attended" : ""}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ) : null}
        </Panel>
      ) : null}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {teachers.length === 0 ? (
          <p className="text-sm">No support teachers yet. Assign the support teacher role on a user first.</p>
        ) : (
          teachers.map((teacher) => (
            <Panel key={teacher.id} className="space-y-2 p-4">
              <span className="block text-lg font-black">{teacher.name}</span>
              <span className="text-xs font-bold">{DUTY_LABEL[teacher.status as DutyStatus] ?? teacher.status}</span>
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
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setDay(key);
                  setSubject(null);
                }}
                className={`rounded-lg py-2 ${day === key ? "bg-white text-brand-900" : "bg-brand-800"} ${
                  inMonth ? "" : "opacity-40"
                }`}
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
          <div className="mt-2 flex gap-2" role="group" aria-label="Subject">
            <button
              type="button"
              onClick={() => setSubject("ebrw")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black ${
                subject === "ebrw" ? "bg-white text-brand-900" : "bg-brand-800 text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" aria-hidden="true" /> English
            </button>
            <button
              type="button"
              onClick={() => setSubject("math")}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-black ${
                subject === "math" ? "bg-white text-brand-900" : "bg-brand-800 text-white"
              }`}
            >
              <Calculator className="h-3.5 w-3.5" aria-hidden="true" /> Math
            </button>
          </div>
          {day && subject ? (
            <div key={subject} className="widen-in">
              <SupportHandoff day={day} subject={subject} />
            </div>
          ) : (
            <p className="widen-in mt-2 text-sm">Choose English or Math.</p>
          )}
          </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
