import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { PageHead, Panel } from "@/components/ui/panel";
import { listActiveClasses } from "@/lib/classes/api";
import { signedUrl } from "@/lib/classes/api";
import { uploadHomeworkFile } from "@/lib/classes/uploads";
import { createNotification } from "@/lib/notifications/client";
import { fetchVocabDecks } from "@/lib/vocab/client";
import {
  createVocabHomework,
  deleteVocabHomework,
  listHomeworkCompletions,
  listVocabHomeworkAssignments,
  type VocabHomeworkAssignment,
} from "@/lib/vocab/homework";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin/vocab/assignments")({
  component: AdminVocabAssignmentsPage,
  head: () => ({ meta: [{ title: "Assignments — Admin" }] }),
});

const inputCls =
  "mt-1 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white";

function AdminVocabAssignmentsPage() {
  const [assignments, setAssignments] = useState<VocabHomeworkAssignment[]>([]);
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [decks, setDecks] = useState<{ id: string; title: string }[]>([]);
  const [quizzes, setQuizzes] = useState<{ id: string; title: string }[]>([]);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof listHomeworkCompletions>>>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [instructions, setInstructions] = useState("");
  const [targetType, setTargetType] = useState<"deck" | "quiz">("deck");
  const [deckId, setDeckId] = useState("");
  const [quizId, setQuizId] = useState("");
  const [cardTarget, setCardTarget] = useState(20);
  const [recurrence, setRecurrence] = useState<"once" | "daily" | "weekly">("daily");
  const [audienceType, setAudienceType] = useState<"class" | "all" | "users">("all");
  const [classId, setClassId] = useState("");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [displaySeconds, setDisplaySeconds] = useState(604800);

  const [notifyTitle, setNotifyTitle] = useState("");
  const [notifyBody, setNotifyBody] = useState("");
  const [notifyLink, setNotifyLink] = useState("");
  const [notifyImage, setNotifyImage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, c, d, q, p] = await Promise.all([
        listVocabHomeworkAssignments(),
        listActiveClasses(),
        fetchVocabDecks(),
        supabase.from("vocab_quizzes").select("id,title").order("title"),
        supabase.from("profiles").select("id,full_name").order("full_name").limit(200),
      ]);
      setAssignments(a);
      setClasses(c.map((x) => ({ id: x.id, name: x.name })));
      setDecks(d.filter((x) => !x.is_folder).map((x) => ({ id: x.id, title: x.title })));
      setQuizzes((q.data ?? []) as { id: string; title: string }[]);
      setProfiles((p.data ?? []) as { id: string; full_name: string | null }[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setProgress([]);
      return;
    }
    void listHomeworkCompletions(selectedId).then(setProgress).catch(() => setProgress([]));
  }, [selectedId]);

  const selectedAssignment = useMemo(
    () => assignments.find((a) => a.id === selectedId) ?? null,
    [assignments, selectedId],
  );

  async function handleCreateAssignment() {
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createVocabHomework({
        title,
        instructions,
        targetType,
        deckId: targetType === "deck" ? deckId : undefined,
        quizId: targetType === "quiz" ? quizId : undefined,
        cardTarget: targetType === "deck" ? cardTarget : undefined,
        recurrence,
        audienceType,
        classId: audienceType === "class" ? classId : undefined,
        userIds: audienceType === "users" ? selectedUsers : undefined,
        displaySeconds,
      });
      setTitle("");
      setInstructions("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function handleSendNotification() {
    if (!notifyTitle.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createNotification({
        title: notifyTitle,
        body: notifyBody,
        imageUrl: notifyImage ?? undefined,
        linkUrl: notifyLink || undefined,
        linkLabel: "Open",
        audienceType,
        classId: audienceType === "class" ? classId : undefined,
        userIds: audienceType === "users" ? selectedUsers : undefined,
        displaySeconds,
      });
      setNotifyTitle("");
      setNotifyBody("");
      setNotifyLink("");
      setNotifyImage(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Notification failed");
    } finally {
      setBusy(false);
    }
  }

  async function onNotifyImage(file: File) {
    const uploaded = await uploadHomeworkFile(file, file.name, "notifications");
    const url = await signedUrl("homework-uploads", uploaded.storage_path, file.name);
    setNotifyImage(url);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <PageHead
        title="Vocab assignments"
        subtitle="Assign deck study or quizzes, track student progress, and send dashboard notifications."
      />

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand-300" />
        </div>
      ) : (
        <>
          {error ? (
            <Panel className="border-red-400/40 bg-red-900/20 p-4 text-sm text-red-200">{error}</Panel>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-2">
            <Panel className="space-y-4">
              <h2 className="text-lg font-black text-white">New assignment</h2>
              <label className="block text-sm font-semibold text-brand-100">
                Title
                <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-sm font-semibold text-brand-100">
                Instructions
                <textarea
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  rows={2}
                  className={inputCls}
                />
              </label>
              <div className="flex gap-2">
                {(["deck", "quiz"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTargetType(t)}
                    className={
                      "rounded-lg px-3 py-2 text-sm font-bold " +
                      (targetType === t ? "bg-brand-600 text-white" : "bg-brand-900 text-brand-100")
                    }
                  >
                    {t === "deck" ? "Deck study" : "Quiz"}
                  </button>
                ))}
              </div>
              {targetType === "deck" ? (
                <>
                  <label className="block text-sm font-semibold text-brand-100">
                    Deck
                    <select value={deckId} onChange={(e) => setDeckId(e.target.value)} className={inputCls}>
                      <option value="">Select deck</option>
                      {decks.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-brand-100">
                    Cards to review (all Good/Easy)
                    <input
                      type="number"
                      min={1}
                      value={cardTarget}
                      onChange={(e) => setCardTarget(Number(e.target.value))}
                      className={inputCls}
                    />
                  </label>
                </>
              ) : (
                <label className="block text-sm font-semibold text-brand-100">
                  Quiz
                  <select value={quizId} onChange={(e) => setQuizId(e.target.value)} className={inputCls}>
                    <option value="">Select quiz</option>
                    {quizzes.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="block text-sm font-semibold text-brand-100">
                Recurrence
                <select
                  value={recurrence}
                  onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
                  className={inputCls}
                >
                  <option value="once">Once</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </select>
              </label>
              <label className="block text-sm font-semibold text-brand-100">
                Audience
                <select
                  value={audienceType}
                  onChange={(e) => setAudienceType(e.target.value as typeof audienceType)}
                  className={inputCls}
                >
                  <option value="all">All students</option>
                  <option value="class">Class</option>
                  <option value="users">Selected students</option>
                </select>
              </label>
              {audienceType === "class" ? (
                <select value={classId} onChange={(e) => setClassId(e.target.value)} className={inputCls}>
                  <option value="">Select class</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              ) : null}
              {audienceType === "users" ? (
                <select
                  multiple
                  value={selectedUsers}
                  onChange={(e) =>
                    setSelectedUsers(Array.from(e.target.selectedOptions, (o) => o.value))
                  }
                  className={inputCls + " min-h-28"}
                >
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.full_name ?? p.id}
                    </option>
                  ))}
                </select>
              ) : null}
              <label className="block text-sm font-semibold text-brand-100">
                Notification display (seconds)
                <input
                  type="number"
                  min={1}
                  value={displaySeconds}
                  onChange={(e) => setDisplaySeconds(Number(e.target.value))}
                  className={inputCls}
                />
                <span className="mt-1 block text-xs text-brand-200/70">
                  e.g. 3600 = 1 hour · 86400 = 1 day
                </span>
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleCreateAssignment()}
                className="btn-brand rounded-lg bg-grad-brand px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Publish assignment
              </button>
            </Panel>

            <Panel className="space-y-4">
              <h2 className="text-lg font-black text-white">Send notification</h2>
              <label className="block text-sm font-semibold text-brand-100">
                Title
                <input
                  value={notifyTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-semibold text-brand-100">
                Message
                <textarea
                  value={notifyBody}
                  onChange={(e) => setNotifyBody(e.target.value)}
                  rows={3}
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-semibold text-brand-100">
                Link URL
                <input
                  value={notifyLink}
                  onChange={(e) => setNotifyLink(e.target.value)}
                  placeholder="/vocab or /classes"
                  className={inputCls}
                />
              </label>
              <label className="block text-sm font-semibold text-brand-100">
                Image
                <input
                  type="file"
                  accept="image/*"
                  className="mt-1 block text-sm text-brand-100"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void onNotifyImage(f);
                  }}
                />
              </label>
              {notifyImage ? (
                <img src={notifyImage} alt="" className="h-16 w-16 rounded-lg object-cover" />
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSendNotification()}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> Send notification
              </button>
            </Panel>
          </div>

          <Panel className="space-y-4">
            <h2 className="text-lg font-black text-white">Assignments</h2>
            {assignments.length === 0 ? (
              <p className="text-sm text-brand-100">No assignments yet.</p>
            ) : (
              <div className="space-y-2">
                {assignments.map((a) => (
                  <div
                    key={a.id}
                    className={
                      "flex items-center justify-between gap-3 rounded-xl border px-3 py-2 " +
                      (selectedId === a.id
                        ? "border-brand-300 bg-brand-800"
                        : "border-brand-400/30 bg-brand-900/40")
                    }
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedId(a.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="truncate font-bold text-white">{a.title}</div>
                      <div className="text-xs text-brand-100">
                        {a.target_type} · {a.recurrence} · {a.audience_type}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (confirm("Delete this assignment?")) {
                          void deleteVocabHomework(a.id).then(load);
                        }
                      }}
                      className="rounded p-2 text-brand-100 hover:bg-red-900/40 hover:text-red-200"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {selectedAssignment ? (
            <Panel className="space-y-3">
              <h2 className="text-lg font-black text-white">
                Progress · {selectedAssignment.title}
              </h2>
              {progress.length === 0 ? (
                <p className="text-sm text-brand-100">No student activity yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-brand-100">
                      <tr>
                        <th className="py-2 pr-4">Student</th>
                        <th className="py-2 pr-4">Period</th>
                        <th className="py-2 pr-4">Progress</th>
                        <th className="py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {progress.map((row) => (
                        <tr key={row.id} className="border-t border-brand-400/20 text-white">
                          <td className="py-2 pr-4">{row.user_id.slice(0, 8)}…</td>
                          <td className="py-2 pr-4">{row.period_key}</td>
                          <td className="py-2 pr-4">
                            {row.quiz_total != null
                              ? `${row.quiz_score}/${row.quiz_total}`
                              : `${row.cards_reviewed} cards (${row.green_reviews} green)`}
                          </td>
                          <td className="py-2">
                            <span
                              className={
                                row.status === "completed"
                                  ? "text-emerald-300"
                                  : "text-brand-100"
                              }
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>
          ) : null}
        </>
      )}
    </div>
  );
}
