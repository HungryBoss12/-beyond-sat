import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import {
  DUTY_LABEL,
  ORIGIN_LABEL,
  formatWhen,
  loadAdminTeachers,
  loadSupportDay,
  loadTeacherDetail,
  postSupportRange,
  setSupportDuty,
  tashkentCalendarToday,
  type DutyStatus,
  type NamedSession,
  type SupportTeacherCard,
  type TeacherDetail,
} from "@/lib/support/api";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeacherDetail | null>(null);
  const [dutyMinutes, setDutyMinutes] = useState("180");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string | null>(null);
  const [daySessions, setDaySessions] = useState<NamedSession[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setTeachers(await loadAdminTeachers());
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load teachers"));
  }, []);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    void loadTeacherDetail(openId)
      .then(setDetail)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load that teacher"));
  }, [openId]);

  useEffect(() => {
    if (!day) return;
    void loadSupportDay(day)
      .then(setDaySessions)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load that day"));
  }, [day]);

  const days = useMemo(() => monthGrid(month), [month]);

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
      <h1 className="text-2xl font-black text-brand-900">Support teachers</h1>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <div className="grid gap-3 md:grid-cols-2">
        {teachers.length === 0 ? (
          <p className="text-sm">No support teachers yet. Assign the support teacher role on a user first.</p>
        ) : (
          teachers.map((teacher) => (
            <Panel key={teacher.id} className="space-y-2 p-4">
              <button type="button" className="w-full text-left" onClick={() => setOpenId(openId === teacher.id ? null : teacher.id)}>
                <span className="block text-lg font-black">{teacher.name}</span>
                <span className="text-xs font-bold">{DUTY_LABEL[teacher.status as DutyStatus] ?? teacher.status}</span>
                <span className="mt-1 block text-xs">
                  {teacher.done_count} done · {teacher.planned_count} planned
                  {teacher.duty_ends_at ? ` · on duty until ${formatWhen(teacher.duty_ends_at)}` : ""}
                </span>
              </button>
              {openId === teacher.id && detail && (
                <div className="space-y-3 border-t border-white/10 pt-3 text-sm">
                  <label className="block text-xs font-bold">
                    On duty for minutes
                    <input
                      type="number"
                      min={15}
                      max={840}
                      value={dutyMinutes}
                      onChange={(event) => setDutyMinutes(event.target.value)}
                      className="mt-1 block w-32 rounded-xl bg-brand-800 px-3 py-2 text-sm"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={busy}
                    className="rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900"
                    onClick={() => void saveDuty(teacher.id)}
                  >
                    Set timer
                  </button>
                  <div className="flex flex-wrap items-end gap-2">
                    <input
                      type="datetime-local"
                      value={rangeStart}
                      onChange={(event) => setRangeStart(event.target.value)}
                      className="rounded-xl bg-brand-800 px-3 py-2 text-sm"
                    />
                    <input
                      type="datetime-local"
                      value={rangeEnd}
                      onChange={(event) => setRangeEnd(event.target.value)}
                      className="rounded-xl bg-brand-800 px-3 py-2 text-sm"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      className="text-xs font-bold underline"
                      onClick={() =>
                        void postSupportRange(rangeStart, rangeEnd, teacher.id)
                          .then(() => toast.success("Slots opened"))
                          .catch((err: unknown) => toast.error(err instanceof Error ? err.message : "Could not open slots"))
                      }
                    >
                      Open slots
                    </button>
                  </div>
                  <div>
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
                  <div>
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
              )}
            </Panel>
          ))
        )}
      </div>

      <Panel className="space-y-3 p-4">
        <div className="flex items-center justify-between">
          <button
            type="button"
            className="text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
          >
            Previous
          </button>
          <h2 className="text-sm font-black">
            {month.toLocaleString("en-GB", { month: "long", year: "numeric" })}
          </h2>
          <button
            type="button"
            className="text-sm font-bold"
            onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
          >
            Next
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
                onClick={() => setDay(key)}
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
          className={`overflow-hidden transition-[max-height,opacity] duration-300 ${
            day ? "max-h-[480px] opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <h3 className="text-sm font-black">{day}</h3>
          {daySessions.length === 0 ? (
            <p className="mt-2 text-sm">No sessions this day.</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {daySessions.map((session) => (
                <li key={session.id}>
                  {formatWhen(session.starts_at)} · {session.teacher_name} · {session.student_name} ·{" "}
                  {ORIGIN_LABEL[session.origin]} · {session.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>
    </div>
  );
}
