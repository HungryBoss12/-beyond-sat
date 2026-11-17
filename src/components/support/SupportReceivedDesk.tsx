import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarClock, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { Panel } from "@/components/ui/panel";
import { AttendanceTick, SupportHandoff } from "@/components/support/SupportHandoff";
import { SupportMonthCalendar } from "@/components/support/SupportMonthCalendar";
import {
  formatWhen,
  loadComingStudents,
  loadMySupportSubject,
  loadSupportMonthCounts,
  setSupportTick,
  subjectLabel,
  tashkentCalendarDate,
  tashkentCalendarToday,
  type ComingStudent,
} from "@/lib/support/api";
import { initialSupportDay, monthGridCells, tashkentDayKey } from "@/lib/support/desk";
import type { ClassSubject } from "@/lib/classes/types";

export function SupportReceivedDesk() {
  const todayKey = useMemo(() => initialSupportDay(), []);
  const [coming, setComing] = useState<ComingStudent[]>([]);
  const [loadingComing, setLoadingComing] = useState(true);
  const [comingError, setComingError] = useState<string | null>(null);
  const [subject, setSubject] = useState<ClassSubject | null | undefined>(undefined);
  const [month, setMonth] = useState(() => tashkentCalendarToday());
  const [day, setDay] = useState<string>(() => initialSupportDay());
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [sheetTick, setSheetTick] = useState(0);

  const { fromDay, toDay } = useMemo(() => monthGridCells(month), [month]);

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

  const loadMonth = useCallback(async () => {
    try {
      setCounts(await loadSupportMonthCounts(fromDay, toDay));
    } catch {
      // Calendar remains interactive even if badge counts fail on a weak connection.
    }
  }, [fromDay, toDay]);

  const refreshSummary = useCallback(() => {
    void loadBookings();
    void loadMonth();
  }, [loadBookings, loadMonth]);

  useEffect(() => {
    void loadBookings();
  }, [loadBookings]);

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
        <div className="flex items-center justify-between gap-2">
          <h2 className="inline-flex items-center gap-2 text-sm font-black">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
            {loadingComing ? "Upcoming bookings" : `${coming.length} booked`}
          </h2>
          {subject ? (
            <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-bold">
              {subjectLabel(subject)}
            </span>
          ) : null}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/30 text-xs">
                <th className="px-2 py-2">When</th>
                <th className="px-2 py-2">Student</th>
                <th className="px-2 py-2">Class</th>
                <th className="px-2 py-2 text-right">Present</th>
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
