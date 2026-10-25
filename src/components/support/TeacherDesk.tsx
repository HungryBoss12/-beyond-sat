import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { Panel } from "@/components/ui/panel";
import type { ClassSubject } from "@/lib/classes/types";
import {
  ORIGIN_LABEL,
  assignSupportWindow,
  confirmSupport,
  declineSupport,
  formatWhen,
  loadComingStudents,
  loadStaffSessions,
  loadWindowBoard,
  postSupportRange,
  setSupportAttendance,
  startSupportBreak,
  subjectLabel,
  type ComingStudent,
  type SupportSession,
  type SupportWindow,
} from "@/lib/support/api";

type SortKey = "date" | "name" | "groups";

export function TeacherDesk() {
  const [coming, setComing] = useState<ComingStudent[]>([]);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [windows, setWindows] = useState<SupportWindow[]>([]);
  const [sort, setSort] = useState<SortKey>("date");
  const [direction, setDirection] = useState<1 | -1>(1);
  const [minutes, setMinutes] = useState("60");
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [studentName, setStudentName] = useState("");
  const [subject, setSubject] = useState<ClassSubject>("ebrw");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextComing, nextSessions, nextWindows] = await Promise.all([
      loadComingStudents(),
      loadStaffSessions(),
      loadWindowBoard(),
    ]);
    setComing(nextComing);
    setSessions(nextSessions);
    setWindows(nextWindows);
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
      <h1 className="text-2xl font-black text-brand-900">Support</h1>
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
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
                    <button type="button" className="underline" onClick={() => chooseSort(key)}>
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
                        A
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
                        Confirm
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="text-xs font-bold underline"
                        onClick={() => void run(() => declineSupport(session.id, "Declined"), "Request declined")}
                      >
                        Decline
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
          className="rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900"
          onClick={() => {
            const length = Number(minutes);
            if (!Number.isInteger(length) || length < 1 || length > 120) {
              toast.error("A break is at most 2 hours");
              return;
            }
            void run(() => startSupportBreak(length), "Break started. Booked students were notified.");
          }}
        >
          Start break
        </button>
        <p className="text-xs">Sessions already booked in this time are cancelled.</p>
      </Panel>

      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-black">Open windows</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold">
            From
            <input
              type="datetime-local"
              value={rangeStart}
              onChange={(event) => setRangeStart(event.target.value)}
              className="mt-1 block rounded-xl bg-brand-800 px-3 py-2 text-sm"
            />
          </label>
          <label className="text-xs font-bold">
            To
            <input
              type="datetime-local"
              value={rangeEnd}
              onChange={(event) => setRangeEnd(event.target.value)}
              className="mt-1 block rounded-xl bg-brand-800 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            className="rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900"
            onClick={() => void run(() => postSupportRange(rangeStart, rangeEnd).then(() => undefined), "Windows opened")}
          >
            Add half-hour slots
          </button>
        </div>
        <ul className="space-y-2 text-sm">
          {windows.map((window) => (
            <li key={window.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {formatWhen(window.starts_at)} · {window.student_name || "Free"}
              </span>
              {!window.student_id && (
                <button type="button" className="text-xs font-bold underline" onClick={() => setAssignFor(window.id)}>
                  Assign
                </button>
              )}
            </li>
          ))}
        </ul>
        {assignFor && (
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run(async () => {
                await assignSupportWindow(assignFor, studentName, subject);
                setAssignFor(null);
                setStudentName("");
              }, "Session assigned");
            }}
          >
            <label className="text-xs font-bold">
              Username
              <input
                value={studentName}
                onChange={(event) => setStudentName(event.target.value)}
                className="mt-1 block rounded-xl bg-brand-800 px-3 py-2 text-sm"
              />
            </label>
            <AdminSelect
              label="Subject"
              value={subject}
              onValueChange={(value) => setSubject(value as ClassSubject)}
              options={[
                { value: "ebrw", label: "English" },
                { value: "math", label: "Math" },
              ]}
              tone="brand"
            />
            <button type="submit" disabled={busy} className="rounded-full bg-white px-4 py-2 text-sm font-black text-brand-900">
              Save
            </button>
          </form>
        )}
      </Panel>
    </div>
  );
}
