import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, NotebookPen, Play, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { RevealCard } from "@/components/ui/reveal-card";
import { EmptyState } from "@/components/ui/panel";
import { IconButton } from "@/components/ui/icon-button";
import {
  createHomework,
  listHomework,
  listSubmissionsForAssignment,
  reviewSubmission,
  type HomeworkAssignment,
  type HomeworkSubmission,
  type HomeworkSubmissionStatus,
} from "@/lib/classes";
import { listGroupLessons, type ClassGroup, type GroupLesson } from "@/lib/classes/groups";
import { HW_ITEM_LABEL, HW_ITEM_LETTER, itemsFor, type HwItem } from "@/lib/classes/schemes";
import { shortDate } from "@/lib/classes/schedule";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { CLASS_CONTROL } from "./control";
import type { GridPerson } from "./LessonGrids";

const REVIEW_STATUSES = ["accepted", "needs_revision", "reviewed"] as const;
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  submitted: "Submitted",
  reviewed: "Reviewed",
  accepted: "Accepted",
  needs_revision: "Needs revision",
};

function packName(row: { lesson_topics: unknown }): string {
  const topic = row.lesson_topics as
    | { lesson_subjects: { title: string } | { title: string }[] | null }
    | { lesson_subjects: { title: string } | { title: string }[] | null }[]
    | null;
  const one = Array.isArray(topic) ? topic[0] : topic;
  const subject = one?.lesson_subjects;
  const named = Array.isArray(subject) ? subject[0]?.title : subject?.title;
  return named || "Lessons";
}

async function loadLessonVideos(): Promise<
  { id: string; title: string; video_url: string; pack: string }[]
> {
  const [lessonsRes, recRes] = await Promise.all([
    supabase
      .from("lessons")
      .select("id, title, video_url, lesson_topics(lesson_subjects(title))")
      .eq("published", true)
      .not("video_url", "is", null),
    supabase
      .from("lesson_recommended_videos")
      .select("id, title, youtube_url, lesson_topics(lesson_subjects(title))")
      .order("sort_order"),
  ]);
  if (lessonsRes.error) throw new Error(lessonsRes.error.message);
  if (recRes.error) throw new Error(recRes.error.message);
  const uploaded = (lessonsRes.data ?? []).flatMap((row) =>
    row.video_url
      ? [
          {
            id: row.id,
            title: row.title,
            video_url: row.video_url,
            pack: packName(row),
          },
        ]
      : [],
  );
  const teacher = (recRes.data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    video_url: row.youtube_url,
    pack: packName(row),
  }));
  return [...teacher, ...uploaded];
}

/** Teacher check / grade / feedback for one sub-class. Kinds follow the scheme (AFL: A F). */
export function HomeworkPanel({
  group,
  month,
  people,
}: {
  group: ClassGroup;
  month: string;
  people: GridPerson[];
}) {
  const kinds = itemsFor(group.subject);
  const [items, setItems] = useState<HomeworkAssignment[]>([]);
  const [lessons, setLessons] = useState<GroupLesson[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [kind, setKind] = useState<HwItem | "">("");
  const [lessonId, setLessonId] = useState("");
  const [maxScore, setMaxScore] = useState("");
  const [due, setDue] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoTitle, setVideoTitle] = useState("");
  const [packOpen, setPackOpen] = useState(false);
  const [packLessons, setPackLessons] = useState<
    { id: string; title: string; video_url: string; pack: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState<HomeworkAssignment | null>(null);
  const [kindFilter, setKindFilter] = useState<HwItem | "">("");
  const [lessonFilter, setLessonFilter] = useState("");

  const reload = useCallback(async () => {
    const [rows, lessonRows] = await Promise.all([
      listHomework(group.class_id, group.subject),
      listGroupLessons(group.id, month).catch(() => []),
    ]);
    setItems(rows);
    setLessons(lessonRows);
  }, [group.class_id, group.subject, group.id, month]);

  useEffect(() => {
    void reload().catch((err) =>
      toast.error(err instanceof Error ? err.message : "Could not load homework"),
    );
  }, [reload]);

  async function publish() {
    if (!title.trim()) return toast.error("Title required");
    const max = maxScore.trim() ? Number(maxScore) : null;
    if (max != null && (!Number.isInteger(max) || max <= 0))
      return toast.error("Max score must be a whole number");
    setSaving(true);
    try {
      const hw = await createHomework({
        class_id: group.class_id,
        subject: group.subject,
        title,
        body,
        due_at: due ? new Date(due).toISOString() : null,
        var_kind: kind || null,
        lesson_id: lessonId || null,
        max_score: max,
        video_url: videoUrl,
      });
      setTitle("");
      setBody("");
      setVideoUrl(null);
      setVideoTitle("");
      toast.success("Homework published");
      await reload();
      setOpen(hw);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish");
    } finally {
      setSaving(false);
    }
  }

  const shown = items.filter(
    (item) =>
      (!kindFilter || item.var_kind === kindFilter) &&
      (!lessonFilter || item.lesson_id === lessonFilter),
  );

  return (
    <div className="space-y-4">
      <form
        className="space-y-2 rounded-xl border border-brand-400/40 bg-brand-800 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void publish();
        }}
      >
        <div className="grid gap-2 sm:grid-cols-3">
          <label className="block text-xs font-bold text-white">
            Links to
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={kind}
              onChange={(e) => setKind(e.target.value as HwItem | "")}
            >
              <option value="">No {group.subject === "math" ? "AFL" : "VAR"} tick</option>
              {kinds.map((item) => (
                <option key={item} value={item}>
                  {HW_ITEM_LETTER[item]} · {HW_ITEM_LABEL[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-white">
            Lesson
            <select
              className={CLASS_CONTROL + " mt-1"}
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
            >
              <option value="">No lesson</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {shortDate(lesson.lesson_date)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-xs font-bold text-white">
            Max score
            <input
              inputMode="numeric"
              className={CLASS_CONTROL + " mt-1"}
              value={maxScore}
              onChange={(e) => setMaxScore(e.target.value.replace(/\D/g, ""))}
            />
          </label>
        </div>
        <input
          className={CLASS_CONTROL}
          placeholder="Title"
          aria-label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className={CLASS_CONTROL}
          rows={3}
          placeholder="Instructions"
          aria-label="Instructions"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <div className="flex flex-wrap items-end gap-2">
          <label className="block text-xs font-bold text-white">
            Due
            <input
              type="datetime-local"
              className={CLASS_CONTROL + " mt-1"}
              value={due}
              onChange={(e) => setDue(e.target.value)}
            />
          </label>
          <IconButton
            icon={Play}
            label={videoTitle ? `Video: ${videoTitle}` : "Attach a lesson video"}
            className="text-white"
            onClick={() => {
              setPackOpen(true);
              void loadLessonVideos().then(setPackLessons).catch((e) => {
                toast.error(e instanceof Error ? e.message : "Could not load lesson videos");
              });
            }}
          />
          <button
            type="submit"
            disabled={saving}
            className="btn-brand ml-auto inline-flex items-center gap-1 rounded-full bg-brand-400 px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Plus className="h-3.5 w-3.5" />
            )}
            Publish
          </button>
        </div>
      </form>
      {packOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-brand-900/70 p-4">
          <div className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-2xl bg-brand-600 p-4 text-white">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-black">Lesson video</h2>
              <IconButton icon={X} label="Close" className="text-white" onClick={() => setPackOpen(false)} />
            </div>
            {packLessons.length === 0 ? (
              <p className="text-sm text-brand-100">No lesson videos yet.</p>
            ) : (
            <ul className="space-y-1">
              {packLessons.map((lesson) => (
                <li key={lesson.id}>
                  <button
                    type="button"
                    className="tap w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-brand-500"
                    onClick={() => {
                      setVideoUrl(lesson.video_url);
                      setVideoTitle(`${lesson.pack} · ${lesson.title}`);
                      setPackOpen(false);
                    }}
                  >
                    <span className="block text-[10px] font-bold uppercase text-brand-100">{lesson.pack}</span>
                    {lesson.title}
                  </button>
                </li>
              ))}
            </ul>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <select
          aria-label="Filter by kind"
          className={CLASS_CONTROL + " w-auto"}
          value={kindFilter}
          onChange={(e) => setKindFilter(e.target.value as HwItem | "")}
        >
          <option value="">All kinds</option>
          {kinds.map((item) => (
            <option key={item} value={item}>
              {HW_ITEM_LABEL[item]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by lesson"
          className={CLASS_CONTROL + " w-auto"}
          value={lessonFilter}
          onChange={(e) => setLessonFilter(e.target.value)}
        >
          <option value="">All lessons</option>
          {lessons.map((lesson) => (
            <option key={lesson.id} value={lesson.id}>
              {shortDate(lesson.lesson_date)}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={NotebookPen}
          title="No homework yet"
          body={`Publish homework for ${group.name}.`}
        />
      ) : (
        <div className="grid gap-2 stagger-fast">
          {shown.map((item) => (
            <RevealCard
              key={item.id}
              className="lift rounded-xl border border-brand-400/40 bg-brand-800 p-3"
            >
              <button type="button" className="tap w-full text-left" onClick={() => setOpen(item)}>
                <div className="text-sm font-black">{item.title}</div>
                <div className="text-xs text-white">
                  {item.var_kind
                    ? `${HW_ITEM_LETTER[item.var_kind as HwItem]} · ${HW_ITEM_LABEL[item.var_kind as HwItem]}`
                    : "No tick"}
                  {item.max_score ? ` · out of ${item.max_score}` : ""}
                  {item.due_at ? ` · due ${item.due_at.slice(0, 10)}` : ""}
                </div>
              </button>
            </RevealCard>
          ))}
        </div>
      )}
      {open && <ReviewSheet assignment={open} people={people} onClose={() => setOpen(null)} />}
    </div>
  );
}

function ReviewSheet({
  assignment,
  people,
  onClose,
}: {
  assignment: HomeworkAssignment;
  people: GridPerson[];
  onClose: () => void;
}) {
  const [subs, setSubs] = useState<HomeworkSubmission[]>([]);
  const [index, setIndex] = useState(0);
  const [note, setNote] = useState("");
  const [score, setScore] = useState("");
  const saveRef = useRef<(status: HomeworkSubmissionStatus) => Promise<void>>(async () => {});

  const load = useCallback(async () => {
    setSubs(await listSubmissionsForAssignment(assignment.id));
  }, [assignment.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const names = new Map(people.map((p) => [p.userId, p.name]));
  const ids = [...new Set([...subs.map((row) => row.student_id), ...people.map((p) => p.userId)])];
  const currentId = ids[index];
  const current = subs.find((row) => row.student_id === currentId);

  useEffect(() => {
    setNote(current?.review_note ?? "");
    setScore(current?.score != null ? String(current.score) : "");
  }, [current?.id, current?.review_note, current?.score]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const typing =
        event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement;
      if (!typing && event.key === "j") setIndex((value) => Math.min(ids.length - 1, value + 1));
      if (!typing && event.key === "k") setIndex((value) => Math.max(0, value - 1));
      if (event.key === "Escape") onClose();
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        void saveRef.current("reviewed");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ids.length, onClose]);

  async function save(status: HomeworkSubmissionStatus) {
    if (!current) return void toast.error("This student has not submitted");
    if (status === "needs_revision" && !note.trim())
      return void toast.error("Feedback is required for needs revision");
    const parsed = score.trim() === "" ? null : Number(score);
    if (
      parsed != null &&
      (!Number.isInteger(parsed) ||
        parsed < 0 ||
        (assignment.max_score != null && parsed > assignment.max_score))
    ) {
      return void toast.error(`Score must be 0–${assignment.max_score ?? "max"}`);
    }
    try {
      await reviewSubmission(current.id, status, note, parsed);
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
        role="dialog"
        aria-modal="true"
        aria-label={`Review ${assignment.title}`}
        className="h-full w-full max-w-md overflow-y-auto bg-brand-800 p-5 text-white shadow-panel"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate font-black text-white">{assignment.title}</h3>
          <IconButton
            icon={X}
            label="Close"
            className="text-white hover:bg-brand-500"
            onClick={onClose}
          />
        </div>
        <p className="mt-1 text-xs text-white">
          J/K next student · Ctrl/Cmd+Enter saves as reviewed
        </p>
        <p className="mt-4 text-sm font-bold">
          {currentId ? (names.get(currentId) ?? currentId.slice(0, 8)) : "No students"}
          <span className="ml-2 text-xs text-white">
            {index + 1}/{ids.length}
          </span>
        </p>
        <p className="text-xs text-white">
          {current ? (STATUS_LABEL[current.status] ?? current.status) : "Not submitted"}
        </p>
        {current?.note && <p className="mt-2 whitespace-pre-wrap text-sm">{current.note}</p>}
        <label className="mt-3 block text-xs font-bold text-white">
          Score{assignment.max_score ? ` (out of ${assignment.max_score})` : ""}
          <input
            inputMode="numeric"
            className={CLASS_CONTROL + " mt-1"}
            value={score}
            onChange={(e) => setScore(e.target.value.replace(/\D/g, ""))}
          />
        </label>
        <label className="mt-3 block text-xs font-bold text-white">
          Feedback
          <textarea
            className={CLASS_CONTROL + " mt-1"}
            rows={4}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          {REVIEW_STATUSES.map((status) => (
            <button
              key={status}
              type="button"
              disabled={!current}
              onClick={() => void save(status)}
              className={cn(
                "tap rounded-full px-3 py-1.5 text-xs font-bold disabled:opacity-40",
                status === "accepted" ? "btn-brand bg-brand-400" : "bg-brand-600",
              )}
            >
              {STATUS_LABEL[status]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
