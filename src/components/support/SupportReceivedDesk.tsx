import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, RotateCw, Users } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { AttendanceTick, SupportHandoff } from "@/components/support/SupportHandoff";
import { SupportMonthCalendar } from "@/components/support/SupportMonthCalendar";
import {
  formatWhen,
  loadComingStudents,
  loadMySupportSubject,
  loadReceivedStudents,
  loadSupportMonthCounts,
  setSupportTick,
  subjectLabel,
  tashkentCalendarDate,
  tashkentCalendarToday,
  type ComingStudent,
  type ReceivedStudent,
} from "@/lib/support/api";
import {
  initialSupportDay,
  monthGridCells,
  resolveSupportDeskTab,
  tashkentDayKey,
  type SupportDeskTab,
} from "@/lib/support/desk";
import type { ClassSubject } from "@/lib/classes/types";

export function SupportReceivedDesk() {
  const todayKey = useMemo(() => initialSupportDay(), []);
  const [coming, setComing] = useState<ComingStudent[]>([]);
  const [loadingComing, setLoadingComing] = useState(true);
  const [comingError, setComingError] = useState<string | null>(null);
  const [received, setReceived] = useState<ReceivedStudent[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(true);
  const [receivedError, setReceivedError] = useState<string | null>(null);
  const [preferredTab, setPreferredTab] = useState<SupportDeskTab | null>(null);
  const [subject, setSubject] = useState<ClassSubject | null | undefined>(undefined);
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string>(() => initialSupportDay());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetTick, setSheetTick] = useState(0);

  const { fromDay, toDay } = useMemo(() => monthGridCells(month), [month]);
  const activeTab = resolveSupportDeskTab(preferredTab, {
    comingCount: coming.length,
    receivedCount: received.length,
    loadingComing,
  });

  const loadBookings = useCallback(async () => {
    setLoadingComing(true);
    setComingError(null);
    try {
      setComing(await loadComingStudents());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load bookings";
      setComingError(message);
      toast.error(message);
    } finally {
      setLoadingComing(false);
    }
  }, []);

  const loadStudents = useCallback(async () => {
    setLoadingReceived(true);
    setReceivedError(null);
    try {
      setReceived(await loadReceivedStudents());
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not load students";
      setReceivedError(message);
      toast.error(message);
    } finally {
      setLoadingReceived(false);
    }
  }, []);

  const loadMonth = useCallback(async () => {
    try {
      setCounts(await loadSupportMonthCounts(fromDay, toDay));
    } catch {
      // Calendar remains interactive even if badge counts fail on a weak connection.
    }
  }, [fromDay, toDay]);

  const refreshSummary = useCallback(() => {
    void loadBookings();
    void loadStudents();
    void loadMonth();
  }, [loadBookings, loadStudents, loadMonth]);

  useEffect(() => {
    void loadBookings();
    void loadStudents();
  }, [loadBookings, loadStudents]);

  useEffect(() => {
    void loadMonth();
  }, [loadMonth]);

  useEffect(() => {
    if (subject !== undefined) return;
    let cancelled = false;
    void loadMySupportSubject()
      .then((next) => {
        if (!cancelled) setSubject(next);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load your subject");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [day, subject]);

  function focusBooking(item: ComingStudent) {
    const targetDay = tashkentDayKey(item.starts_at);
    if (!targetDay) return;
    setMonth(tashkentCalendarDate(item.starts_at));
    setDay(targetDay);
  }

  async function toggleAttendance(item: ComingStudent) {
    if (busyId) return;
    const next = item.attended !== true;
    setBusyId(item.id);
    try {
      await setSupportTick(item.id, "attendance", next);
      toast.success(next ? "Marked present" : "Marked absent");
      refreshSummary();
      setSheetTick((tick) => tick + 1);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save attendance");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-brand-900">Support</h1>
      <Panel className="space-y-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div
            role="tablist"
            aria-label="Support student lists"
            className="inline-flex rounded-full bg-brand-800 p-0.5 text-xs font-black"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "booked"}
              onClick={() => setPreferredTab("booked")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
                activeTab === "booked" ? "bg-white text-brand-900" : "text-white/85"
              }`}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {loadingComing ? "Booked" : `Booked (${coming.length})`}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "students"}
              onClick={() => setPreferredTab("students")}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-colors ${
                activeTab === "students" ? "bg-white text-brand-900" : "text-white/85"
              }`}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              {loadingReceived ? "Students" : `Students (${received.length})`}
            </button>
          </div>
          {subject ? (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
              {subjectLabel(subject)}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          {activeTab === "booked" ? (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/30 text-xs">
                  <th className="px-2 py-2 whitespace-nowrap">When</th>
                  <th className="px-2 py-2 whitespace-nowrap">Student</th>
                  <th className="px-2 py-2 whitespace-nowrap">Class</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Present</th>
                </tr>
              </thead>
              <tbody>
                {loadingComing && coming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3">
                      Loading bookings…
                    </td>
                  </tr>
                ) : comingError && coming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3">
                      <span>{comingError}</span>{" "}
                      <button
                        type="button"
                        onClick={() => void loadBookings()}
                        className="ml-2 inline-flex items-center gap-1 font-bold underline"
                      >
                        <RotateCw className="h-3 w-3" aria-hidden="true" /> Try again
                      </button>
                    </td>
                  </tr>
                ) : coming.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-2 py-3">
                      No upcoming bookings right now.
                    </td>
                  </tr>
                ) : (
                  coming.map((row) => (
                    <tr key={row.id} className="border-b border-white/15">
                      <td className="px-2 py-2 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => focusBooking(row)}
                          className="font-bold underline"
                        >
                          {formatWhen(row.starts_at)}
                        </button>
                      </td>
                      <td className="px-2 py-2 font-bold">{row.student_name}</td>
                      <td className="px-2 py-2">{row.groups || "—"}</td>
                      <td className="px-2 py-2">
                        <div className="flex justify-end">
                          <AttendanceTick
                            on={row.attended}
                            label={`Attendance for ${row.student_name}`}
                            disabled={busyId !== null}
                            onClick={() => void toggleAttendance(row)}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-white/30 text-xs">
                  <th className="px-2 py-2 whitespace-nowrap">Student</th>
                  <th className="px-2 py-2 whitespace-nowrap">Class</th>
                  <th className="px-2 py-2 text-right whitespace-nowrap">Subject</th>
                </tr>
              </thead>
              <tbody>
                {loadingReceived && received.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3">
                      Loading students…
                    </td>
                  </tr>
                ) : receivedError && received.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3">
                      <span>{receivedError}</span>{" "}
                      <button
                        type="button"
                        onClick={() => void loadStudents()}
                        className="ml-2 inline-flex items-center gap-1 font-bold underline"
                      >
                        <RotateCw className="h-3 w-3" aria-hidden="true" /> Try again
                      </button>
                    </td>
                  </tr>
                ) : received.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-2 py-3">
                      No students assigned to you yet.
                    </td>
                  </tr>
                ) : (
                  received.map((row) => (
                    <tr key={row.id} className="border-b border-white/15">
                      <td className="px-2 py-2 font-bold">{row.name}</td>
                      <td className="px-2 py-2">{row.class_name || "—"}</td>
                      <td className="px-2 py-2 text-right whitespace-nowrap">
                        {subjectLabel(row.subject)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </Panel>
      <Panel className="space-y-3 p-4">
        <SupportMonthCalendar
          month={month}
          selectedDay={day}
          todayKey={todayKey}
          counts={counts}
          onMonthChange={setMonth}
          onSelectDay={setDay}
        />
        {day ? (
          <div key={`${day}:${sheetTick}`} className="widen-in space-y-2">
            {subject ? (
              <p className="text-xs font-bold">
                {subjectLabel(subject)} sessions for {day}. Choose a student for an open time.
              </p>
            ) : subject === null ? (
              <p className="text-xs font-bold">
                Sessions for {day}. An admin has not set your subject yet.
              </p>
            ) : (
              <p className="text-xs font-bold">Sessions for {day}.</p>
            )}
            <SupportHandoff day={day} selfSubject={subject} own onChange={refreshSummary} />
          </div>
        ) : null}
      </Panel>
    </div>
  );
}
