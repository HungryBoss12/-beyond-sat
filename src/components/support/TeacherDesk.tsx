import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowUpDown, BookOpen, Calculator, CalendarClock, Check, Coffee, X } from "lucide-react";
import { Panel } from "@/components/ui/panel";
import { SupportHandoff } from "@/components/support/SupportHandoff";
import {
  ORIGIN_LABEL,
  confirmSupport,
  declineSupport,
  formatWhen,
  loadComingStudents,
  loadStaffSessions,
  setSupportAttendance,
  startSupportBreak,
  subjectLabel,
  calendarDay,
  tashkentCalendarToday,
  type ComingStudent,
  type SupportSession,
} from "@/lib/support/api";
import type { ClassSubject } from "@/lib/classes/types";

type SortKey = "date" | "name" | "groups";

export function TeacherDesk() {
  const [coming, setComing] = useState<ComingStudent[]>([]);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [sort, setSort] = useState<SortKey>("date");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [minutes, setMinutes] = useState("60");
  const [day, setDay] = useState(() => calendarDay(tashkentCalendarToday()));
  const [subject, setSubject] = useState<ClassSubject | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextComing, nextSessions] = await Promise.all([
      loadComingStudents(),
      loadStaffSessions(),
    ]);
    setComing(nextComing);
    setSessions(nextSessions);
  }

  useEffect(() => {
    void load().catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load support"));
  }, []);

  const rows = useMemo(() => {
    const copy = [...coming];
    copy.sort((a, b) => {
      const left = sort === "date" ? a.starts_at : sort === "name" ? a.student_name : a.groups;
      const right = sort === "date" ? b.starts_at : sort === "name" ? b.student_name : b.groups;
      return left.localeCompare(right) * direction;
    });
    return copy;
  }, [coming, sort, direction]);

  function chooseSort(key: SortKey) {
    if (sort === key) setDirection((current) => (current === 1 ? -1 : 1));
    else {
      setSort(key);
      setDirection(1);
    }
  }

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update support");
    } finally {
      setBusy(false);
    }
  }

  const now = Date.now();
  const upcoming = sessions.filter(
    (session) =>
      (session.status === "pending" || session.status === "confirmed") &&
      (!session.ends_at || new Date(session.ends_at).getTime() >= now),
  );
  const past = sessions.filter((session) => !upcoming.includes(session) && session.status !== "rejected");

  return (
    <div className="space-y-4">
      <h1 className="inline-flex items-center gap-2 text-2xl font-black text-brand-900">
        <CalendarClock className="h-6 w-6" aria-hidden="true" /> Support
      </h1>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <Panel className="space-y-3 p-4">
        <label className="block text-xs font-bold">
          Assign a support slot
          <input
            type="date"
            value={day}
            onChange={(event) => {
              setDay(event.target.value);
              setSubject(null);
            }}
            className="mt-1 block rounded-xl bg-brand-800 px-3 py-2 text-sm"
          />
        </label>
        <p className="text-xs">Choose English or Math after the date. The day’s list opens for that subject only.</p>
        {day ? (
          <div key={day} className="widen-in flex gap-2" role="group" aria-label="Subject">
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
        ) : null}
        {day && subject ? (
          <div key={subject} className="widen-in">
            <SupportHandoff day={day} subject={subject} />
          </div>
        ) : null}
      </Panel>
      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-black">Students coming</h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs">
                {(
                  [
                    ["date", "Date"],
                    ["name", "Name"],
                    ["groups", "Groups"],
                  ] as const
                ).map(([key, label]) => (
                  <th key={key} className="px-2 py-2 font-bold">
                    <button type="button" className="inline-flex items-center gap-1 underline" onClick={() => chooseSort(key)}>
                      <ArrowUpDown className="h-3 w-3" aria-hidden="true" />
                      {label}
                      {sort === key ? (direction === 1 ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
                <th className="px-2 py-2 font-bold">A</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-2 py-3 text-sm">
                    No confirmed sessions.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.id} className="border-t border-white/10">
                    <td className="px-2 py-2">{formatWhen(row.starts_at)}</td>
                    <td className="px-2 py-2">{row.student_name}</td>
                    <td className="px-2 py-2">{row.groups || "—"}</td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        aria-pressed={row.attended === true}
                        aria-label={`Attendance for ${row.student_name}`}
                        disabled={busy}
                        onClick={() =>
                          void run(
                            () => setSupportAttendance(row.id, row.attended !== true),
                            row.attended === true ? "Attendance cleared" : "Marked present",
                          )
                        }
                        className={`grid h-8 w-8 place-items-center rounded-full text-xs font-black ${
                          row.attended === true ? "bg-white text-brand-900" : "bg-brand-800 ring-1 ring-white/40"
                        }`}
                      >
                        {row.attended === true ? <Check className="h-4 w-4" aria-hidden="true" /> : "A"}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel className="space-y-2 p-4">
          <h2 className="text-sm font-black">Sessions</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm">No upcoming sessions.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {upcoming.map((session) => (
                <li key={session.id} className="rounded-xl bg-brand-800/80 px-3 py-2">
                  <p>
                    {session.student_name} · {subjectLabel(session.subject)} · {formatWhen(session.starts_at)}
                  </p>
                  <p className="text-xs">{ORIGIN_LABEL[session.origin ?? "request"]}</p>
                  {session.status === "pending" && (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs font-bold underline"
                        onClick={() => void run(() => confirmSupport(session.id), "Request confirmed")}
                      >
                        <Check className="mr-1 inline h-3 w-3" aria-hidden="true" /> Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs font-bold underline"
                        onClick={() => void run(() => declineSupport(session.id, "Declined"), "Request declined")}
                      >
                        <X className="mr-1 inline h-3 w-3" aria-hidden="true" /> Decline
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="space-y-2 p-4">
          <h2 className="text-sm font-black">Past sessions</h2>
          {past.length === 0 ? (
            <p className="text-sm">No past sessions.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {past.map((session) => (
                <li key={session.id}>
                  {session.student_name} · {formatWhen(session.starts_at)} · {session.status}
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel className="flex flex-wrap items-end gap-3 p-4">
        <label className="text-xs font-bold">
          Break, minutes
          <input
            type="number"
            min={1}
            max={120}
            value={minutes}
            onChange={(event) => setMinutes(event.target.value)}
            className="mt-1 block w-28 rounded-xl bg-brand-800 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          disabled={busy}
          className="inline-flex items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900"
          onClick={() => {
            const length = Number(minutes);
            if (!Number.isInteger(length) || length < 1 || length > 120) {
              toast.error("A break is at most 2 hours");
              return;
            }
            void run(() => startSupportBreak(length), "Break started. Booked students were notified.");
          }}
        >
          <Coffee className="h-4 w-4" aria-hidden="true" /> Start break
        </button>
        <p className="text-xs">Sessions already booked in this time are cancelled.</p>
      </Panel>
    </div>
  );
}
