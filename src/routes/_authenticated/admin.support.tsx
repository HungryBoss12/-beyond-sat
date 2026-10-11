import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel } from "@/components/ui/panel";
import { CLASS_CONTROL } from "@/components/classes/control";
import {
  addSupportMaterial,
  addSupportSlot,
  completeSupport,
  decideSupport,
  deleteSupportSlot,
  formatWhen,
  loadCenterHours,
  loadOwnSlots,
  loadPublishedTests,
  loadStaffSessions,
  saveCenterHours,
  subjectLabel,
  type CenterHours,
  type SupportSession,
  type SupportSlotRow,
  type SupportStatus,
} from "@/lib/support/api";

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportAdminPage,
  head: () => ({ meta: [{ title: "Support sessions — BeyondSAT" }] }),
});

const adminRoute = getRouteApi("/_authenticated/admin");

const TABS: { id: SupportStatus; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "confirmed", label: "Confirmed" },
  { id: "completed", label: "Completed" },
  { id: "rejected", label: "Declined" },
];

function SupportAdminPage() {
  const { staffRole } = adminRoute.useRouteContext();
  const isAdmin = staffRole === "admin";
  const [hours, setHours] = useState<CenterHours | null>(null);
  const [opens, setOpens] = useState("09:00");
  const [closes, setCloses] = useState("21:00");
  const [slots, setSlots] = useState<SupportSlotRow[]>([]);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [tests, setTests] = useState<{ id: string; title: string }[]>([]);
  const [tab, setTab] = useState<SupportStatus>("pending");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [declineFor, setDeclineFor] = useState<SupportSession | null>(null);
  const [reason, setReason] = useState("");
  const [materialFor, setMaterialFor] = useState<SupportSession | null>(null);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [testId, setTestId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextHours, nextSlots, nextSessions, nextTests] = await Promise.all([
      loadCenterHours(),
      loadOwnSlots(),
      loadStaffSessions(),
      loadPublishedTests().catch(() => []),
    ]);
    setHours(nextHours);
    if (nextHours) {
      setOpens(nextHours.opens_at.slice(0, 5));
      setCloses(nextHours.closes_at.slice(0, 5));
    }
    setSlots(nextSlots);
    setSessions(nextSessions);
    setTests(nextTests);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load support sessions"),
    );
  }, []);

  const shown = sessions.filter((session) => session.status === tab);

  async function saveHours() {
    setBusy(true);
    try {
      await saveCenterHours(opens, closes);
      toast.success("Center hours saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save hours");
    } finally {
      setBusy(false);
    }
  }

  async function createSlot() {
    setBusy(true);
    try {
      await addSupportSlot(start, end);
      toast.success("Slot added");
      setStart("");
      setEnd("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add the slot");
    } finally {
      setBusy(false);
    }
  }

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
      {isAdmin && (
        <Panel className="space-y-3 p-4">
          <h2 className="text-sm font-black text-white">Center hours</h2>
          <p className="text-xs text-white">
            Teachers can only open slots inside this window.
            {hours ? ` Now ${hours.opens_at.slice(0, 5)}–${hours.closes_at.slice(0, 5)}.` : ""}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-bold text-white">
              Opens
              <input className={CLASS_CONTROL + " mt-1"} type="time" value={opens} onChange={(e) => setOpens(e.target.value)} />
            </label>
            <label className="text-xs font-bold text-white">
              Closes
              <input className={CLASS_CONTROL + " mt-1"} type="time" value={closes} onChange={(e) => setCloses(e.target.value)} />
            </label>
            <button
              type="button"
              disabled={busy}
              onClick={() => void saveHours()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
            >
              Save hours
            </button>
          </div>
        </Panel>
      )}
      <Panel className="space-y-3 p-4">
        <h2 className="text-sm font-black text-white">Open slots</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs font-bold text-white">
            Start
            <input className={CLASS_CONTROL + " mt-1"} type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="text-xs font-bold text-white">
            End
            <input className={CLASS_CONTROL + " mt-1"} type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
          </label>
          <button
            type="button"
            disabled={busy || !start || !end}
            onClick={() => void createSlot()}
            className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            Add slot
          </button>
        </div>
        {slots.length === 0 ? (
          <p className="text-xs text-white">No upcoming slots.</p>
        ) : (
          <ul className="space-y-1 text-sm text-white">
            {slots.map((slot) => (
              <li key={slot.id} className="flex items-center justify-between gap-2">
                <span>
                  {formatWhen(slot.starts_at)} – {formatWhen(slot.ends_at)}
                </span>
                <button
                  type="button"
                  className="text-xs font-bold underline"
                  onClick={() => void run(() => deleteSupportSlot(slot.id), "Slot removed")}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
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
                  {formatWhen(session.starts_at)} – {formatWhen(session.ends_at)}
                </p>
                {session.notes && <p className="text-xs">{session.notes}</p>}
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
                        onClick={() => void run(() => decideSupport(session.id, true, ""), "Session confirmed")}
                      >
                        Accept
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
                    <button
                      type="button"
                      disabled={busy}
                      className="rounded-full bg-brand-800 px-3 py-1.5 text-xs font-bold"
                      onClick={() => void run(() => completeSupport(session.id), "Session completed")}
                    >
                      Mark completed
                    </button>
                  )}
                  {session.status !== "rejected" && (
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
                  await decideSupport(declineFor.id, false, reason);
                  setDeclineFor(null);
                }, "Request declined");
              }}
            >
              Decline
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
