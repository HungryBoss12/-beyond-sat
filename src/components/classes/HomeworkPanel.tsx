import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { RevealCard } from "@/components/ui/reveal-card";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  createHomework,
  getChatProfile,
  listClassMembers,
  listHomework,
  listSubmissionsForAssignment,
  reviewSubmission,
  displayName,
  type ChatProfile,
  type HomeworkAssignment,
  type HomeworkSubmission,
  type HomeworkSubmissionStatus,
  type VarKind,
} from "@/lib/classes";
import { listClassLessons, type ClassLesson } from "@/lib/classes/classroom";
import { CLASS_CONTROL } from "./control";

export function HomeworkPanel({ classId, month }: { classId: string; month: string }) {
  const [items, setItems] = useState<HomeworkAssignment[]>([]);
  const [lessons, setLessons] = useState<ClassLesson[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState<"math" | "ebrw">("math");
  const [varKind, setVarKind] = useState<VarKind | "">("");
  const [lessonId, setLessonId] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [due, setDue] = useState("");
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<HomeworkAssignment | null>(null);

  const reload = useCallback(async () => {
    setItems(await listHomework(classId));
    setLessons(await listClassLessons(classId, month).catch(() => []));
  }, [classId, month]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function publish() {
    if (!title.trim()) return toast.error("Title required");
    setSaving(true);
    try {
      const hw = await createHomework({
        class_id: classId,
        subject,
        title,
        body,
        due_at: due ? new Date(due).toISOString() : null,
        var_kind: varKind || null,
        lesson_id: lessonId || null,
        max_score: maxScore ? Number(maxScore) : null,
      });
      setTitle("");
      setBody("");
      toast.success("Homework published");
      await reload();
      setOpen(hw);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-400/40 bg-brand-800 p-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <AdminSelect
            value={subject}
            onValueChange={(v) => setSubject(v as "math" | "ebrw")}
            options={[
              { value: "math", label: "Maths" },
              { value: "ebrw", label: "EBRW" },
            ]}
          />
          <AdminSelect
            value={varKind || "none"}
            onValueChange={(v) => setVarKind(v === "none" ? "" : (v as VarKind))}
            options={[
              { value: "none", label: "NO VAR LINK" },
              { value: "vocab", label: "V VOCABULARY" },
              { value: "assignment", label: "A ASSIGNMENT" },
              { value: "article", label: "R ARTICLE" },
            ]}
          />
          <AdminSelect
            value={lessonId || "none"}
            onValueChange={(v) => setLessonId(v === "none" ? "" : v)}
            options={[
              { value: "none", label: "No lesson" },
              ...lessons.map((lesson) => ({ value: lesson.id, label: lesson.lesson_date })),
            ]}
          />
          <input
            className={CLASS_CONTROL}
            placeholder="Max score"
            value={maxScore}
            onChange={(e) => setMaxScore(e.target.value)}
          />
        </div>
        <input
          className={CLASS_CONTROL + " mt-2"}
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={CLASS_CONTROL + " mt-2"}
          rows={3}
          placeholder="Instructions"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <input
          type="datetime-local"
          className={CLASS_CONTROL + " mt-2"}
          value={due}
          onChange={(e) => setDue(e.target.value)}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void publish()}
          className="btn-brand mt-2 inline-flex items-center gap-1 rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white"
        >
          {saving ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}{" "}
          Publish
        </button>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <RevealCard
            key={item.id}
            className="lift rounded-xl border border-brand-400/40 bg-brand-800 p-3"
          >
            <button type="button" className="w-full text-left" onClick={() => setOpen(item)}>
              <div className="text-sm font-black">{item.title}</div>
              <div className="text-xs text-brand-100">
                {item.subject} {item.var_kind ? `· ${item.var_kind}` : ""}{" "}
                {item.due_at ? `· due ${item.due_at.slice(0, 10)}` : ""}
              </div>
            </button>
          </RevealCard>
        ))}
        {items.length === 0 && (
          <p className="text-sm text-brand-100">No homework for this class yet.</p>
        )}
      </div>
      {open && <ReviewSheet classId={classId} assignment={open} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReviewSheet({
  classId,
  assignment,
  onClose,
}: {
  classId: string;
  assignment: HomeworkAssignment;
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<HomeworkSubmission[]>([]);
  const [members, setMembers] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Map<string, ChatProfile>>(new Map());
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [score, setScore] = useState("");
  const saveRef = useRef<(status: HomeworkSubmissionStatus) => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    const rows = await listSubmissionsForAssignment(assignment.id);
    const memberRows = await listClassMembers(classId);
    setSubs(rows);
    setMembers(memberRows.map((row) => row.user_id));
    const map = new Map<string, ChatProfile>();
    for (const id of [
      ...rows.map((row) => row.student_id),
      ...memberRows.map((row) => row.user_id),
    ]) {
      if (map.has(id)) continue;
      const profile = await getChatProfile(id).catch(() => null);
      if (profile) map.set(id, profile);
    }
    setProfiles(map);
  }, [assignment.id, classId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ids = [...new Set([...subs.map((row) => row.student_id), ...members])];
  const currentId = ids[index];
  const current = subs.find((row) => row.student_id === currentId);

  useEffect(() => {
    setNote(current?.review_note ?? "");
    setScore(current?.score != null ? String(current.score) : "");
  }, [current?.id, current?.review_note, current?.score]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "j") setIndex((value) => Math.min(ids.length - 1, value + 1));
      if (event.key === "k") setIndex((value) => Math.max(0, value - 1));
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void saveRef.current("reviewed");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids.length]);

  async function save(status: HomeworkSubmissionStatus) {
    if (!current) return toast.error("This student has not submitted");
    if (status === "needs_revision" && !note.trim())
      return toast.error("Feedback is required for needs revision");
    try {
      const parsed = score.trim() === "" ? undefined : Number(score);
      await reviewSubmission(
        current.id,
        status,
        note,
        parsed != null && Number.isFinite(parsed) ? parsed : undefined,
      );
      toast.success("Saved");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save review");
    }
  }
  saveRef.current = save;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-brand-900/60" onClick={onClose}>
      <div
        className="h-full w-full max-w-md overflow-y-auto bg-brand-800 p-5 text-white shadow-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black">{assignment.title}</h3>
          <button type="button" onClick={onClose} className="tap text-sm font-bold">
            Close
          </button>
        </div>
        <p className="mt-1 text-xs text-brand-100">J/K next student · Ctrl/Cmd+Enter saves</p>
        <p className="mt-4 text-sm font-bold">
          {currentId
            ? displayName(
                profiles.get(currentId) ?? {
                  username: null,
                  full_name: null,
                  first_name: null,
                  email: null,
                },
              )
            : "No students"}
        </p>
        <p className="text-xs text-brand-100">{current ? current.status : "Not submitted"}</p>
        {current?.note && <p className="mt-2 text-sm">{current.note}</p>}
        <label className="mt-3 block text-xs font-bold text-brand-100">Score</label>
        <input className={CLASS_CONTROL} value={score} onChange={(e) => setScore(e.target.value)} />
        <label className="mt-3 block text-xs font-bold text-brand-100">Feedback</label>
        <textarea
          className={CLASS_CONTROL}
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {(["accepted", "needs_revision", "reviewed"] as const).map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => void save(status)}
              className="tap rounded-full bg-brand-600 px-3 py-1.5 text-xs font-bold"
            >
              {status.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
