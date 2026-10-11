import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { SectionBack } from "@/components/SectionBack";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel } from "@/components/ui/panel";
import { CLASS_CONTROL } from "@/components/classes/control";
import type { ClassSubject } from "@/lib/classes/types";
import { startTestSetSession } from "@/lib/session";
import {
  formatWhen,
  loadCenterHours,
  loadMySessions,
  loadOpenSlots,
  requestSupport,
  subjectLabel,
  type CenterHours,
  type OpenSlot,
  type SupportSession,
} from "@/lib/support/api";

export const Route = createFileRoute("/_authenticated/support-lessons")({
  component: SupportLessonsPage,
  head: () => ({ meta: [{ title: "Support lessons — BeyondSAT" }] }),
});

function SupportLessonsPage() {
  const [hours, setHours] = useState<CenterHours | null>(null);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [slots, setSlots] = useState<OpenSlot[]>([]);
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<ClassSubject>("ebrw");
  const [slotId, setSlotId] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextHours, nextSessions, nextSlots] = await Promise.all([
      loadCenterHours(),
      loadMySessions(),
      loadOpenSlots(),
    ]);
    setHours(nextHours);
    setSessions(nextSessions);
    setSlots(nextSlots);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load support lessons"),
    );
  }, []);

  const now = Date.now();
  const upcoming = sessions.filter(
    (session) =>
      (session.status === "pending" || session.status === "confirmed") &&
      new Date(session.ends_at).getTime() >= now,
  );
  const past = sessions.filter((session) => !upcoming.includes(session));

  async function submit() {
    if (!slotId) {
      toast.error("Pick an open time.");
      return;
    }
    setBusy(true);
    try {
      await requestSupport(slotId, subject, notes);
      toast.success("Request sent");
      setOpen(false);
      setNotes("");
      setSlotId("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send the request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionBack />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-brand-900">Support lessons</h1>
          <p className="mt-1 text-sm text-brand-700">
            {hours
              ? `Center hours ${hours.opens_at.slice(0, 5)}–${hours.closes_at.slice(0, 5)}. Pick a free teacher slot that is not during your class.`
              : "Center hours are not set yet."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white"
        >
          Request a session
        </button>
      </div>
      {error && <p className="text-sm font-bold text-brand-900">{error}</p>}
      <SessionList title="Upcoming" sessions={upcoming} empty="No upcoming sessions." />
      <SessionList title="Past" sessions={past} empty="No past sessions." past />
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Request support</DialogTitle>
          </DialogHeader>
          <label className="block text-xs font-bold">
            Subject
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={subject}
              onChange={(event) => setSubject(event.target.value as ClassSubject)}
            >
              <option value="ebrw">English</option>
              <option value="math">Math</option>
            </select>
          </label>
          <label className="mt-3 block text-xs font-bold">
            Teacher and time
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={slotId}
              onChange={(event) => setSlotId(event.target.value)}
            >
              <option value="">Choose an open slot</option>
              {slots.map((slot) => (
                <option key={slot.slot_id} value={slot.slot_id}>
                  {slot.teacher_name} · {formatWhen(slot.starts_at)}–{formatWhen(slot.ends_at)}
                </option>
              ))}
            </select>
          </label>
          {slots.length === 0 && (
            <p className="mt-2 text-xs text-white">No open slot fits your class schedule.</p>
          )}
          <label className="mt-3 block text-xs font-bold">
            Notes
            <textarea
              className={CLASS_CONTROL + " mt-1 min-h-24"}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="What do you want to work on?"
            />
          </label>
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={busy}
              onClick={() => void submit()}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Send request
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SessionList({
  title,
  sessions,
  empty,
  past,
}: {
  title: string;
  sessions: SupportSession[];
  empty: string;
  past?: boolean;
}) {
  return (
    <Panel className="space-y-3 p-4">
      <h2 className="text-sm font-black text-white">{title}</h2>
      {sessions.length === 0 ? (
        <EmptyState title={empty} body="" />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <li key={session.id} className="rounded-xl bg-brand-800 px-3 py-3 text-sm text-white">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">
                  {subjectLabel(session.subject)} · {session.teacher_name}
                </p>
                <StatusBadge status={session.status} />
              </div>
              <p className="mt-1 text-xs">
                {formatWhen(session.starts_at)} – {formatWhen(session.ends_at)}
              </p>
              {session.notes && <p className="mt-2 text-xs">{session.notes}</p>}
              {session.rejection_reason && (
                <p className="mt-2 text-xs">Declined: {session.rejection_reason}</p>
              )}
              {session.materials.length > 0 && (
                <ul className="mt-2 space-y-1 text-xs">
                  {session.materials.map((item) => (
                    <li key={item.id}>
                      <MaterialLink item={item} />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MaterialLink({ item }: { item: SupportSession["materials"][number] }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  if (item.test_id) {
    return (
      <button
        type="button"
        disabled={busy}
        className="font-bold underline disabled:opacity-40"
        onClick={() => {
          const testId = item.test_id;
          if (!testId) return;
          setBusy(true);
          void startTestSetSession(testId)
            .then(({ sessionId }) =>
              navigate({ to: "/practice/session/$id", params: { id: sessionId } }),
            )
            .catch((err: unknown) =>
              toast.error(err instanceof Error ? err.message : "Could not open the test"),
            )
            .finally(() => setBusy(false));
        }}
      >
        {item.title}
      </button>
    );
  }
  if (item.material_url?.startsWith("https://")) {
    return (
      <a className="font-bold underline" href={item.material_url} target="_blank" rel="noopener noreferrer">
        {item.title}
      </a>
    );
  }
  return <span>{item.title}</span>;
}

function StatusBadge({ status }: { status: SupportSession["status"] }) {
  return (
    <span className="rounded-full bg-brand-400 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
      {status}
    </span>
  );
}
