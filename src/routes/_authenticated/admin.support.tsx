import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SupportCountdown } from "@/components/support/SupportCountdown";
import { SupportHeatmap } from "@/components/support/SupportHeatmap";
import { SupportWhenFields } from "@/components/support/SupportWhenFields";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel } from "@/components/ui/panel";
import { CLASS_CONTROL } from "@/components/classes/control";
import type { ClassSubject } from "@/lib/classes/types";
import {
  addSupportMaterial,
  claimSupport,
  completeSupport,
  declineSupport,
  formatDay,
  formatWhen,
  loadPublishedTests,
  loadStaffSessions,
  loadWindowBoard,
  postSupportRange,
  assignSupportWindow,
  setSupportWindowOpen,
  setSupportStart,
  subjectLabel,
  tashkentCalendarDate,
  tashkentCalendarToday,
  tashkentFromDay,
  type SupportSession,
  type SupportStatus,
  type SupportWindow,
} from "@/lib/support/api";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportAdminPage,
  head: () => ({ meta: [{ title: "Support sessions — BeyondSAT" }] }),
});

const TABS: { id: SupportStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Declined" },
];

function SupportAdminPage() {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [tests, setTests] = useState<{ id: string; title: string }[]>([]);
  const [tab, setTab] = useState<SupportStatus>("pending");
  const [claimFor, setClaimFor] = useState<SupportSession | null>(null);
  const [claimDay, setClaimDay] = useState<Date | undefined>(() => tashkentCalendarToday());
  const [claimClock, setClaimClock] = useState("");
  const [timeFor, setTimeFor] = useState<SupportSession | null>(null);
  const [timeDay, setTimeDay] = useState<Date | undefined>(() => tashkentCalendarToday());
  const [timeClock, setTimeClock] = useState("");
  const [declineFor, setDeclineFor] = useState<SupportSession | null>(null);
  const [reason, setReason] = useState("");
  const [materialFor, setMaterialFor] = useState<SupportSession | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [testId, setTestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [windows, setWindows] = useState<SupportWindow[]>([]);
  const [rangeStart, setRangeStart] = useState("");
  const [rangeEnd, setRangeEnd] = useState("");
  const [assignFor, setAssignFor] = useState<string | null>(null);
  const [studentId, setStudentId] = useState("");
  const [assignSubject, setAssignSubject] = useState<ClassSubject>("ebrw");

  async function load() {
    const [nextSessions, nextTests, nextWindows] = await Promise.all([
      loadStaffSessions(),
      loadPublishedTests().catch(() => []),
      loadWindowBoard().catch(() => []),
    ]);
    setSessions(nextSessions);
    setTests(nextTests);
    setWindows(nextWindows);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load support sessions"),
    );
  }, []);

  const shown = sessions.filter((session) => session.status === tab);

  async function run(action: () => Promise<void>, ok: string) {
    setBusy(true);
    try {
      await action();
      toast.success(ok);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-black text-brand-900">Support sessions</h1>
      {error && <p className="text-sm font-bold text-brand-900">{error}</p>}
      <Panel className="p-4">
        <SupportHeatmap sessions={sessions} />
      </Panel>
      <Panel className="space-y-3 p-4 text-white">
        <h2 className="text-sm font-black text-white">Support sessions</h2>
        <p className="text-xs">
          A range such as 14:30–19:30 is split into 14:30–15:00, 15:00–15:30, and so on. You can
          assign a student to any future session. Students can take an open session only when it
          starts within 24 hours.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold">
            From
            <input className={CLASS_CONTROL + " mt-1"} type="datetime-local" value={rangeStart} onChange={(e) => setRangeStart(e.target.value)} />
          </label>
          <label className="text-xs font-bold">
            To
            <input className={CLASS_CONTROL + " mt-1"} type="datetime-local" value={rangeEnd} onChange={(e) => setRangeEnd(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || !rangeStart || !rangeEnd}
            className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            onClick={() =>
              void run(async () => {
                await postSupportRange(rangeStart, rangeEnd);
                setRangeStart("");
                setRangeEnd("");
              }, "Sessions posted")
            }
          >
            Post sessions
          </button>
        </div>
        <ul className="space-y-1 text-sm">
          {windows.map((window) => (
            <li key={window.id} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {window.teacher_name} · {formatWhen(window.starts_at)} – {formatWhen(window.ends_at)}
                {window.student_name ? ` · ${window.student_name}` : window.closed ? " · closed" : " · open"}
              </span>
              {!window.student_id && (
                <span className="flex gap-3">
                  <button
                    type="button"
                    className="text-xs font-bold underline"
                    onClick={() => {
                      setAssignFor(window.id);
                      setStudentId("");
                      setAssignSubject("ebrw");
                    }}
                  >
                    Assign
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    className="text-xs font-bold underline disabled:opacity-40"
                    onClick={() =>
                      void run(
                        () => setSupportWindowOpen(window.id, Boolean(window.closed)),
                        window.closed ? "Session opened" : "Session closed",
                      )
                    }
                  >
                    {window.closed ? "Open" : "Close"}
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <div className="flex flex-wrap gap-1">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={tab === item.id}
            onClick={() => setTab(item.id)}
            className={
              "tap rounded-full px-3 py-1.5 text-xs font-bold " +
              (tab === item.id ? "bg-brand-500 text-white" : "bg-brand-25 text-brand-700")
            }
          >
            {item.label}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <EmptyState title="Nothing in this list" body="" />
      ) : (
        <ul className="space-y-2">
          {shown.map((session) => (
            <li key={session.id}>
              <Panel className="space-y-2 p-4 text-sm text-white">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-bold">
                    {session.student_name} · {subjectLabel(session.subject)} · {session.teacher_name}
                  </p>
                  <span className="rounded-full bg-brand-400 px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                    {session.status}
                  </span>
                </div>
                <p className="text-xs">
                  {session.starts_at
                    ? `${formatWhen(session.starts_at)}${session.ends_at ? ` – ${formatWhen(session.ends_at)}` : ""}`
                    : formatDay(session.preferred_on)
                      ? `Preferred day ${formatDay(session.preferred_on)}`
                      : "No time yet"}
                </p>
                <SupportCountdown startsAt={session.starts_at} />
                {session.notes && <p className="text-xs">{session.notes}</p>}
                {session.passes?.map((pass, index) => (
                  <p key={`${pass.teacher_name}-${index}`} className="text-xs">
                    {pass.teacher_name} declined{pass.note ? `: ${pass.note}` : "."}
                  </p>
                ))}
                {session.rejection_reason && <p className="text-xs">Note: {session.rejection_reason}</p>}
                {session.materials.length > 0 && (
                  <ul className="text-xs">
                    {session.materials.map((item) => (
                      <li key={item.id}>{item.title}</li>
                    ))}
                  </ul>
                )}
                <div className="flex flex-wrap gap-2">
                  {session.status === "pending" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="btn-brand rounded-full bg-brand-400 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
                        onClick={() => {
                          setClaimDay(tashkentCalendarToday());
                          setClaimClock("");
                          setClaimFor(session);
                        }}
                      >
                        Claim
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold"
                        onClick={() => {
                          setReason("");
                          setDeclineFor(session);
                        }}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {session.status === "confirmed" && (
                    <>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold"
                        onClick={() => {
                          setTimeDay(session.starts_at ? tashkentCalendarDate(session.starts_at) : tashkentCalendarToday());
                          setTimeClock("");
                          setTimeFor(session);
                        }}
                      >
                        {session.starts_at ? "Change time" : "Set time"}
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold"
                        onClick={() => void run(() => completeSupport(session.id), "Session completed")}
                      >
                        Mark completed
                      </button>
                    </>
                  )}
                  {session.teacher_id && session.status !== "rejected" && (
                    <button
                      type="button"
                      className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold"
                      onClick={() => {
                        setTitle("");
                        setUrl("");
                        setTestId("");
                        setMaterialFor(session);
                      }}
                    >
                      Assign material
                    </button>
                  )}
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
      <Dialog open={assignFor != null} onOpenChange={(next) => !next && setAssignFor(null)}>
        <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Assign student</DialogTitle>
          </DialogHeader>
          <label className="block text-xs font-bold">
            Username
            <input className={CLASS_CONTROL + " mt-1"} value={studentId} onChange={(e) => setStudentId(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs font-bold">
            Subject
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={assignSubject}
              onChange={(e) => setAssignSubject(e.target.value as ClassSubject)}
            >
              <option value="ebrw">English</option>
              <option value="math">Math</option>
            </select>
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || !assignFor || !studentId.trim()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!assignFor) return;
                void run(async () => {
                  await assignSupportWindow(assignFor, studentId, assignSubject);
                  setAssignFor(null);
                }, "Student assigned");
              }}
            >
              Assign
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={declineFor != null} onOpenChange={(next) => !next && setDeclineFor(null)}>
        <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Decline request</DialogTitle>
          </DialogHeader>
          <label className="block text-xs font-bold">
            Note for the student (optional)
            <textarea className={CLASS_CONTROL + " mt-1 min-h-20"} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || !declineFor}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!declineFor) return;
                void run(async () => {
                  await declineSupport(declineFor.id, reason);
                  setDeclineFor(null);
                }, "Request declined");
              }}
            >
              Decline
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={claimFor != null} onOpenChange={(next) => !next && setClaimFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Claim request</DialogTitle>
          </DialogHeader>
          <p className="text-xs">Add a start time, or claim it and set the time later.</p>
          <SupportWhenFields
            day={claimDay}
            onDay={setClaimDay}
            time={claimClock}
            onTime={setClaimClock}
            showTime
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy || !claimFor}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!claimFor) return;
                void run(async () => {
                  await claimSupport(claimFor.id, null);
                  setClaimFor(null);
                }, "Request claimed");
              }}
            >
              Claim without a time
            </button>
            <button
              type="button"
              disabled={busy || !claimFor || !claimDay || !claimClock}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!claimFor || !claimDay || !claimClock) return;
                void run(async () => {
                  await claimSupport(claimFor.id, tashkentFromDay(claimDay, claimClock));
                  setClaimFor(null);
                }, "Request claimed");
              }}
            >
              Claim
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={timeFor != null} onOpenChange={(next) => !next && setTimeFor(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Lesson time</DialogTitle>
          </DialogHeader>
          <SupportWhenFields
            day={timeDay}
            onDay={setTimeDay}
            time={timeClock}
            onTime={setTimeClock}
            showTime
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              disabled={busy || !timeFor}
              className="rounded-full bg-brand-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!timeFor) return;
                void run(async () => {
                  await setSupportStart(timeFor.id, null);
                  setTimeFor(null);
                }, "Time cleared");
              }}
            >
              Clear time
            </button>
            <button
              type="button"
              disabled={busy || !timeFor || !timeDay || !timeClock}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!timeFor || !timeDay || !timeClock) return;
                void run(async () => {
                  await setSupportStart(timeFor.id, tashkentFromDay(timeDay, timeClock));
                  setTimeFor(null);
                }, "Time saved");
              }}
            >
              Save time
            </button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={materialFor != null} onOpenChange={(next) => !next && setMaterialFor(null)}>
        <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Assign material</DialogTitle>
          </DialogHeader>
          <label className="block text-xs font-bold">
            Title
            <input className={CLASS_CONTROL + " mt-1"} value={title} onChange={(e) => setTitle(e.target.value)} />
          </label>
          <label className="mt-3 block text-xs font-bold">
            Link
            <input className={CLASS_CONTROL + " mt-1"} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
          </label>
          <label className="mt-3 block text-xs font-bold">
            Practice test
            <select className={CLASS_CONTROL + " mt-1"} value={testId} onChange={(e) => setTestId(e.target.value)}>
              <option value="">None</option>
              {tests.map((test) => (
                <option key={test.id} value={test.id}>
                  {test.title}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              disabled={busy || !materialFor || !title.trim()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
              onClick={() => {
                if (!materialFor) return;
                void run(async () => {
                  await addSupportMaterial({
                    sessionId: materialFor.id,
                    title,
                    url,
                    testId,
                  });
                  setMaterialFor(null);
                }, "Material added");
              }}
            >
              Add
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
