import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DesmosCalculator } from "@/components/DesmosCalculator";
import { BookOpenCheck } from "lucide-react";
import { SupportHeader } from "@/components/support/SupportHeader";
import { SupportRecommendedVideo } from "@/components/support/SupportRecommendedVideo";
import { AdminSelect } from "@/components/admin/AdminSelect";
import { Panel } from "@/components/ui/panel";
import type { ClassSubject } from "@/lib/classes/types";
import {
  ORIGIN_LABEL,
  bookSupportWindow,
  formatWhen,
  loadMySessions,
  loadSupportTeachers,
  loadTeacherSlots,
  prepareSupportWindows,
  subjectLabel,
  type SupportOrigin,
  type SupportSession,
  type SupportTeacherOption,
  type TeacherSlot,
} from "@/lib/support/api";

function Tag({ origin }: { origin?: SupportOrigin }) {
  if (!origin) return null;
  return (
    <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
      {ORIGIN_LABEL[origin]}
    </span>
  );
}

function SessionLine({ session }: { session: SupportSession }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-800/80 px-3 py-2">
      <span>
        {session.teacher_name} · {subjectLabel(session.subject)}
        {session.starts_at ? ` · ${formatWhen(session.starts_at)}` : ""}
        {session.status === "pending" ? " · waiting" : ""}
        {session.status === "rejected" ? " · declined" : ""}
        {session.task ? <span className="mt-1 block text-xs">Task: {session.task}</span> : null}
      </span>
      <Tag origin={session.origin} />
    </li>
  );
}

export function StudentDesk() {
  const [teachers, setTeachers] = useState<SupportTeacherOption[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [slots, setSlots] = useState<TeacherSlot[]>([]);
  const [sessions, setSessions] = useState<SupportSession[]>([]);
  const [subject, setSubject] = useState<ClassSubject>("ebrw");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadSessions() {
    setSessions(await loadMySessions());
  }

  useEffect(() => {
    void Promise.all([prepareSupportWindows(), loadSupportTeachers(), loadMySessions()])
      .then(([, nextTeachers, nextSessions]) => {
        setTeachers(nextTeachers);
        setSessions(nextSessions);
        setTeacherId((current) => current || nextTeachers[0]?.id || "");
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load support"));
  }, []);

  useEffect(() => {
    if (!teacherId) {
      setSlots([]);
      return;
    }
    void loadTeacherSlots(teacherId)
      .then(setSlots)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load slots"));
  }, [teacherId]);

  const now = Date.now();
  const upcoming = sessions
    .filter((session) => {
      if (session.status === "pending") return true;
      if (session.status !== "confirmed") return false;
      return !session.ends_at || new Date(session.ends_at).getTime() >= now;
    })
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());
  const coming = upcoming[0] ?? null;
  const later = upcoming.slice(1);

  async function requestSlot(slot: TeacherSlot) {
    if (slot.state !== "free" || busy) return;
    setBusy(true);
    try {
      await bookSupportWindow(slot.id, subject);
      toast.success("Slot booked");
      setSlots(await loadTeacherSlots(teacherId));
      await loadSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not request that slot");
    } finally {
      setBusy(false);
    }
  }

  const days = new Map<string, TeacherSlot[]>();
  for (const slot of slots) {
    const key = formatWhen(slot.starts_at).replace(/\d{2}:\d{2}$/, "").trim();
    const list = days.get(key) ?? [];
    list.push(slot);
    days.set(key, list);
  }

  return (
    <div className="space-y-4">
      <SupportHeader />
      {error && <p className="text-sm font-bold text-red-700">{error}</p>}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(280px,0.9fr)]">
        <Panel className="space-y-3 p-4 text-white">
          <h2 className="text-sm font-black">Coming up</h2>
          {coming ? <SessionLine session={coming} /> : <p className="text-sm">No session yet.</p>}
          <h2 className="pt-2 text-sm font-black">Upcoming</h2>
          {later.length === 0 ? (
            <p className="text-sm">Nothing else is scheduled.</p>
          ) : (
            <ul className="space-y-2">
              {later.map((session) => (
                <SessionLine key={session.id} session={session} />
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="p-4 text-white">
          <SupportRecommendedVideo />
        </Panel>
      </div>
      <Panel className="space-y-3 p-4 text-white">
        <div className="flex flex-wrap items-end gap-3">
          <AdminSelect
            label="Support teacher"
            value={teacherId || "none"}
            onValueChange={(value) => setTeacherId(value === "none" ? "" : value)}
            options={
              teachers.length
                ? teachers.map((teacher) => ({ value: teacher.id, label: teacher.name }))
                : [{ value: "none", label: "No support teacher yet" }]
            }
            tone="brand"
          />
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
        </div>
        <p className="text-xs">Empty slots can be booked. Taken slots already have a student.</p>
        {[...days.entries()].length === 0 ? (
          <p className="text-sm">This teacher has no open windows.</p>
        ) : (
          <div className="space-y-3">
            {[...days.entries()].map(([day, daySlots]) => (
              <div key={day}>
                <p className="text-xs font-bold">{day}</p>
                <ul className="mt-1 flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <li key={slot.id}>
                      <button
                        type="button"
                        disabled={busy || slot.state !== "free"}
                        onClick={() => void requestSlot(slot)}
                        className={`rounded-xl px-3 py-2 text-xs font-bold ${
                          slot.state === "free"
                            ? "bg-white text-brand-900"
                            : "bg-brand-800 text-white/80"
                        } disabled:cursor-default`}
                      >
                        {formatWhen(slot.starts_at).slice(-5)} ·{" "}
                        {slot.state === "free" ? "Book" : slot.state === "mine" ? "Yours" : slot.state === "break" ? "Break" : "Taken"}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
      {coming?.task && (
        <Panel className="space-y-2 p-4 text-white">
          <h2 className="inline-flex items-center gap-2 text-sm font-black">
            <BookOpenCheck className="h-4 w-4" aria-hidden="true" /> Task from your teacher
          </h2>
          <p className="text-sm">{coming.task}</p>
        </Panel>
      )}
      <DesmosCalculator />
    </div>
  );
}
