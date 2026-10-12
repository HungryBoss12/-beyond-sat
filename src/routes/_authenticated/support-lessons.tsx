import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { SectionBack } from "@/components/SectionBack";
import { SupportHeader } from "@/components/support/SupportHeader";
import { SupportHeatmap } from "@/components/support/SupportHeatmap";
import { SupportRecommendedVideo } from "@/components/support/SupportRecommendedVideo";
import { SupportSessionCard } from "@/components/support/SupportSessionCard";
import { SupportStats } from "@/components/support/SupportStats";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState, Panel } from "@/components/ui/panel";
import { CLASS_CONTROL } from "@/components/classes/control";
import type { ClassSubject } from "@/lib/classes/types";
import {
  bookSupportWindow,
  cancelSupport,
  formatWhen,
  loadBookableWindows,
  loadMySessions,
  type SupportSession,
  type SupportWindow,
} from "@/lib/support/api";

export const Route = createFileRoute("/_authenticated/support-lessons")({
  component: SupportLessonsPage,
  head: () => ({ meta: [{ title: "Support lessons — BeyondSAT" }] }),
});

function SupportLessonsPage() {
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [windows, setWindows] = useState<SupportWindow[]>([]);
  const [takeFor, setTakeFor] = useState<SupportWindow | null>(null);
  const [subject, setSubject] = useState<ClassSubject>("ebrw");
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const [nextSessions, nextWindows] = await Promise.all([
      loadMySessions(),
      loadBookableWindows().catch(() => []),
    ]);
    setSessions(nextSessions);
    setWindows(nextWindows);
  }

  useEffect(() => {
    void load().catch((err: unknown) =>
      setError(err instanceof Error ? err.message : "Could not load support lessons"),
    );
  }, []);

  const now = Date.now();
  const upcoming = sessions.filter((session) => {
    if (session.status === "pending") return true;
    if (session.status !== "confirmed") return false;
    if (!session.ends_at) return true;
    return new Date(session.ends_at).getTime() >= now;
  });
  const past = sessions.filter((session) => !upcoming.includes(session));

  async function take(window: SupportWindow) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await bookSupportWindow(window.id, subject);
      toast.success("Session booked");
      setTakeFor(null);
      setSubject("ebrw");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not book");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function cancel(session: SupportSession) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await cancelSupport(session.id);
      toast.success("Request cancelled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel the request");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <SectionBack />
      <SupportHeader />
      <Panel className="space-y-2 p-4 text-white">
        <h2 className="text-sm font-black text-white">Open sessions</h2>
        <p className="text-xs">These are the only times you can request. Each one starts within 24 hours.</p>
        {windows.length === 0 ? (
          <p className="text-sm">Nothing is open in the next 24 hours.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {windows.map((window) => (
              <li key={window.id} className="flex items-center justify-between gap-2">
                <span>
                  {window.teacher_name} · {formatWhen(window.starts_at)} – {formatWhen(window.ends_at)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  className="text-xs font-bold underline disabled:opacity-40"
                  onClick={() => {
                    setSubject("ebrw");
                    setTakeFor(window);
                  }}
                >
                  Take this session
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {error && <p className="text-sm font-bold text-brand-900">{error}</p>}
      <SupportStats sessions={sessions} />
      <Panel className="p-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
          <SupportHeatmap sessions={sessions} />
          <SupportRecommendedVideo />
        </div>
      </Panel>
      <SessionList
        title="Upcoming"
        sessions={upcoming}
        empty="No upcoming sessions"
        body="Take an open session above. A teacher can also assign one to you."
        onCancel={(session) => void cancel(session)}
        cancelling={busy}
      />
      <SessionList
        title="Past"
        sessions={past}
        empty="No past sessions"
        body="Completed and declined sessions show up here."
        onCancel={(session) => void cancel(session)}
        cancelling={busy}
      />
      <Dialog open={takeFor != null} onOpenChange={(next) => !next && setTakeFor(null)}>
        <DialogContent className="border-brand-400/40 bg-brand-800 text-white sm:rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-white">Take this session</DialogTitle>
          </DialogHeader>
          {takeFor && (
            <p className="text-xs">
              {takeFor.teacher_name} · {formatWhen(takeFor.starts_at)} – {formatWhen(takeFor.ends_at)}
            </p>
          )}
          <label className="mt-3 block text-xs font-bold">
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
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              disabled={busy || !takeFor}
              onClick={() => {
                if (!takeFor) return;
                void take(takeFor);
              }}
              className="btn-brand rounded-full bg-brand-400 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
            >
              Book
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
  body,
  onCancel,
  cancelling = false,
}: {
  title: string;
  sessions: SupportSession[];
  empty: string;
  body: string;
  onCancel?: (session: SupportSession) => void;
  cancelling?: boolean;
}) {
  return (
    <Panel className="space-y-3 p-4">
      <h2 className="text-sm font-black text-white">{title}</h2>
      {sessions.length === 0 ? (
        <EmptyState title={empty} body={body} />
      ) : (
        <ul className="space-y-2">
          {sessions.map((session) => (
            <SupportSessionCard
              key={session.id}
              session={session}
              onCancel={onCancel}
              cancelling={cancelling}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}
