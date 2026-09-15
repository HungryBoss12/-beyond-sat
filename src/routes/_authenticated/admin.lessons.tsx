import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ChevronDown,
  ChevronUp,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { MixedMathEditor } from "@/components/MixedMathEditor";
import { ListSkeleton } from "@/components/ui/skeletons";
import { AdminSelect } from "@/components/admin/AdminSelect";
import {
  createLesson,
  createRecommended,
  createTopic,
  deleteLesson,
  deleteRecommended,
  deleteTopic,
  fetchStaffTree,
  swapSortOrder,
  updateLesson,
  updateRecommended,
  updateTopic,
} from "@/lib/lessons/client";
import { uploadLessonVideo } from "@/lib/lessons/uploads";
import { formatDuration } from "@/lib/lessons/video";
import type { Lesson, LessonSubject, LessonTopic, RecommendedVideo } from "@/lib/lessons/types";

export const Route = createFileRoute("/_authenticated/admin/lessons")({
  component: AdminLessons,
  head: () => ({ meta: [{ title: "Lessons — Admin — BeyondSAT" }] }),
});

const CONTROL =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

type TopicDraft = {
  id?: string;
  subject_id: string;
  title: string;
  description: string;
  sort_order: number;
};

type RecDraft = {
  id?: string;
  topic_id: string;
  title: string;
  youtube_url: string;
  sort_order: number;
  duration_minutes: string;
};

type LessonDraft = {
  id?: string;
  topic_id: string;
  title: string;
  sort_order: number;
  body: string;
  video_url: string;
  video_path: string;
  duration_minutes: string;
  published: boolean;
};

function AdminLessons() {
  const [subjects, setSubjects] = useState<LessonSubject[]>([]);
  const [topics, setTopics] = useState<LessonTopic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [recommended, setRecommended] = useState<RecommendedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSubjects, setOpenSubjects] = useState<Record<string, boolean>>({});
  const [openTopics, setOpenTopics] = useState<Record<string, boolean>>({});
  const [topicDraft, setTopicDraft] = useState<TopicDraft | null>(null);
  const [lessonDraft, setLessonDraft] = useState<LessonDraft | null>(null);
  const [recDraft, setRecDraft] = useState<RecDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function load() {
    try {
      const tree = await fetchStaffTree();
      setSubjects(tree.subjects);
      setTopics(tree.topics);
      setLessons(tree.lessons);
      setRecommended(tree.recommended);
      setError(null);
      setOpenSubjects((prev) => {
        if (Object.keys(prev).length) return prev;
        return Object.fromEntries(tree.subjects.map((s) => [s.id, true]));
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load lessons");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const topicsBySubject = useMemo(() => {
    const map = new Map<string, LessonTopic[]>();
    for (const topic of topics) {
      const list = map.get(topic.subject_id) ?? [];
      list.push(topic);
      map.set(topic.subject_id, list);
    }
    return map;
  }, [topics]);

  const lessonsByTopic = useMemo(() => {
    const map = new Map<string, Lesson[]>();
    for (const lesson of lessons) {
      const list = map.get(lesson.topic_id) ?? [];
      list.push(lesson);
      map.set(lesson.topic_id, list);
    }
    return map;
  }, [lessons]);

  const recsByTopic = useMemo(() => {
    const map = new Map<string, RecommendedVideo[]>();
    for (const row of recommended) {
      const list = map.get(row.topic_id) ?? [];
      list.push(row);
      map.set(row.topic_id, list);
    }
    return map;
  }, [recommended]);

  async function moveTopic(subjectId: string, index: number, dir: -1 | 1) {
    const list = topicsBySubject.get(subjectId) ?? [];
    const other = list[index + dir];
    if (!other) return;
    await swapSortOrder("lesson_topics", list[index], other);
    await load();
  }

  async function moveLesson(topicId: string, index: number, dir: -1 | 1) {
    const list = lessonsByTopic.get(topicId) ?? [];
    const other = list[index + dir];
    if (!other) return;
    await swapSortOrder("lessons", list[index], other);
    await load();
  }

  async function moveRec(topicId: string, index: number, dir: -1 | 1) {
    const list = recsByTopic.get(topicId) ?? [];
    const other = list[index + dir];
    if (!other) return;
    await swapSortOrder("lesson_recommended_videos", list[index], other);
    await load();
  }

  async function saveTopic() {
    if (!topicDraft?.title.trim()) return;
    setSaving(true);
    try {
      if (topicDraft.id) {
        await updateTopic(topicDraft.id, topicDraft);
      } else {
        await createTopic(topicDraft);
      }
      setTopicDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save topic");
    } finally {
      setSaving(false);
    }
  }

  async function saveLesson() {
    if (!lessonDraft?.title.trim()) return;
    setSaving(true);
    try {
      const minutes = Number(lessonDraft.duration_minutes);
      const duration_seconds =
        Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
      const payload = {
        topic_id: lessonDraft.topic_id,
        title: lessonDraft.title,
        sort_order: lessonDraft.sort_order,
        body: lessonDraft.body,
        video_url: lessonDraft.video_url || null,
        video_path: lessonDraft.video_path || null,
        duration_seconds,
        published: lessonDraft.published,
      };
      if (lessonDraft.id) {
        await updateLesson(lessonDraft.id, payload);
      } else {
        await createLesson(payload);
      }
      setLessonDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save lesson");
    } finally {
      setSaving(false);
    }
  }

  async function saveRec() {
    if (!recDraft?.title.trim() || !recDraft.youtube_url.trim()) return;
    setSaving(true);
    try {
      const minutes = Number(recDraft.duration_minutes);
      const duration_seconds =
        Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes * 60) : null;
      const payload = {
        title: recDraft.title,
        youtube_url: recDraft.youtube_url,
        sort_order: recDraft.sort_order,
        duration_seconds,
      };
      if (recDraft.id) await updateRecommended(recDraft.id, payload);
      else await createRecommended({ ...payload, topic_id: recDraft.topic_id });
      setRecDraft(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save YouTube video");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-black tracking-tight text-slate-900">Lessons</h1>
        <p className="mt-1 text-sm text-slate-500">
          SAT skills, uploaded lesson videos, and recommended YouTube clips. Drafts stay hidden
          until you publish.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-xl bg-brand-25 px-3 py-2 text-sm font-semibold text-brand-700">
          {error}
        </p>
      )}

      {loading ? (
        <ListSkeleton rows={6} />
      ) : (
        <div className="space-y-3">
          {subjects.map((subject) => {
            const subjectTopics = topicsBySubject.get(subject.id) ?? [];
            const open = openSubjects[subject.id] ?? true;
            return (
              <section
                key={subject.id}
                className="overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel"
              >
                <button
                  type="button"
                  onClick={() =>
                    setOpenSubjects((s) => ({ ...s, [subject.id]: !open }))
                  }
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <span className="text-sm font-bold text-white">{subject.title}</span>
                  <span className="text-xs font-semibold text-brand-100">
                    {subjectTopics.length} skill{subjectTopics.length === 1 ? "" : "s"}
                  </span>
                </button>
                {open && (
                  <div className="border-t border-brand-400/30 px-3 py-3">
                    <div className="mb-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() =>
                          setTopicDraft({
                            subject_id: subject.id,
                            title: "",
                            description: "",
                            sort_order: subjectTopics.length,
                          })
                        }
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-400 px-3 py-1.5 text-xs font-bold text-white"
                      >
                        <Plus className="h-3.5 w-3.5" /> SAT skill
                      </button>
                    </div>
                    <div className="space-y-2">
                      {subjectTopics.map((topic, topicIdx) => {
                        const topicLessons = lessonsByTopic.get(topic.id) ?? [];
                        const topicRecs = recsByTopic.get(topic.id) ?? [];
                        const topicOpen = openTopics[topic.id] ?? true;
                        return (
                          <div
                            key={topic.id}
                            className="rounded-xl bg-brand-800/70 ring-1 ring-brand-400/30"
                          >
                            <div className="flex items-center gap-2 px-3 py-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenTopics((s) => ({ ...s, [topic.id]: !topicOpen }))
                                }
                                className="min-w-0 flex-1 text-left"
                              >
                                <p className="truncate text-sm font-semibold text-white">
                                  {topic.title}
                                </p>
                                {topic.description && (
                                  <p className="truncate text-xs text-brand-100">
                                    {topic.description}
                                  </p>
                                )}
                              </button>
                              <IconBtn
                                label="Move topic up"
                                onClick={() => moveTopic(subject.id, topicIdx, -1)}
                                disabled={topicIdx === 0}
                              >
                                <ChevronUp className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn
                                label="Move topic down"
                                onClick={() => moveTopic(subject.id, topicIdx, 1)}
                                disabled={topicIdx === subjectTopics.length - 1}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn
                                label="Edit topic"
                                onClick={() =>
                                  setTopicDraft({
                                    id: topic.id,
                                    subject_id: topic.subject_id,
                                    title: topic.title,
                                    description: topic.description ?? "",
                                    sort_order: topic.sort_order,
                                  })
                                }
                              >
                                <Pencil className="h-4 w-4" />
                              </IconBtn>
                              <IconBtn
                                label="Delete topic"
                                onClick={async () => {
                                  if (!confirm("Delete this topic and its lessons?")) return;
                                  await deleteTopic(topic.id);
                                  await load();
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </IconBtn>
                            </div>
                            {topicOpen && (
                              <div className="border-t border-brand-400/20 px-3 py-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setLessonDraft({
                                      topic_id: topic.id,
                                      title: "",
                                      sort_order: topicLessons.length,
                                      body: "",
                                      video_url: "",
                                      video_path: "",
                                      duration_minutes: "",
                                      published: false,
                                    })
                                  }
                                  className="mb-2 inline-flex items-center gap-1 text-xs font-bold text-brand-200 hover:text-white"
                                >
                                  <Plus className="h-3.5 w-3.5" /> Lesson
                                </button>
                                <ul className="space-y-1">
                                  {topicLessons.map((lesson, lessonIdx) => (
                                    <li
                                      key={lesson.id}
                                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-700/60"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">
                                          {lesson.title}
                                        </p>
                                        <p className="text-[11px] text-brand-100">
                                          {lesson.published ? "Published" : "Draft"}
                                          {formatDuration(lesson.duration_seconds)
                                            ? ` · ${formatDuration(lesson.duration_seconds)}`
                                            : ""}
                                        </p>
                                      </div>
                                      <IconBtn
                                        label="Move lesson up"
                                        onClick={() => moveLesson(topic.id, lessonIdx, -1)}
                                        disabled={lessonIdx === 0}
                                      >
                                        <ChevronUp className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Move lesson down"
                                        onClick={() => moveLesson(topic.id, lessonIdx, 1)}
                                        disabled={lessonIdx === topicLessons.length - 1}
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Edit lesson"
                                        onClick={() =>
                                          setLessonDraft({
                                            id: lesson.id,
                                            topic_id: lesson.topic_id,
                                            title: lesson.title,
                                            sort_order: lesson.sort_order,
                                            body: lesson.body,
                                            video_url: lesson.video_url ?? "",
                                            video_path: lesson.video_path ?? "",
                                            duration_minutes: lesson.duration_seconds
                                              ? String(Math.round(lesson.duration_seconds / 60))
                                              : "",
                                            published: lesson.published,
                                          })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Delete lesson"
                                        onClick={async () => {
                                          if (!confirm("Delete this lesson?")) return;
                                          await deleteLesson(lesson.id);
                                          await load();
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </IconBtn>
                                    </li>
                                  ))}
                                </ul>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setRecDraft({
                                      topic_id: topic.id,
                                      title: "",
                                      youtube_url: "",
                                      sort_order: topicRecs.length,
                                      duration_minutes: "",
                                    })
                                  }
                                  className="mb-2 mt-3 inline-flex items-center gap-1 text-xs font-bold text-brand-200 hover:text-white"
                                >
                                  <Plus className="h-3.5 w-3.5" /> YouTube
                                </button>
                                <ul className="space-y-1">
                                  {topicRecs.map((row, recIdx) => (
                                    <li
                                      key={row.id}
                                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-brand-700/60"
                                    >
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-white">{row.title}</p>
                                        <p className="truncate text-[11px] text-brand-100">{row.youtube_url}</p>
                                      </div>
                                      <IconBtn
                                        label="Move YouTube up"
                                        onClick={() => moveRec(topic.id, recIdx, -1)}
                                        disabled={recIdx === 0}
                                      >
                                        <ChevronUp className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Move YouTube down"
                                        onClick={() => moveRec(topic.id, recIdx, 1)}
                                        disabled={recIdx === topicRecs.length - 1}
                                      >
                                        <ChevronDown className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Edit YouTube"
                                        onClick={() =>
                                          setRecDraft({
                                            id: row.id,
                                            topic_id: row.topic_id,
                                            title: row.title,
                                            youtube_url: row.youtube_url,
                                            sort_order: row.sort_order,
                                            duration_minutes: row.duration_seconds
                                              ? String(Math.round(row.duration_seconds / 60))
                                              : "",
                                          })
                                        }
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </IconBtn>
                                      <IconBtn
                                        label="Delete YouTube"
                                        onClick={async () => {
                                          if (!confirm("Remove this YouTube recommendation?")) return;
                                          await deleteRecommended(row.id);
                                          await load();
                                        }}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </IconBtn>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      {topicDraft && (
        <Modal title={topicDraft.id ? "Edit SAT skill" : "New SAT skill"} onClose={() => setTopicDraft(null)}>
          <Field label="Title">
            <input
              value={topicDraft.title}
              onChange={(e) => setTopicDraft({ ...topicDraft, title: e.target.value })}
              className={CONTROL}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={topicDraft.description}
              onChange={(e) => setTopicDraft({ ...topicDraft, description: e.target.value })}
              rows={3}
              className={CONTROL}
            />
          </Field>
          <Field label="Order">
            <input
              type="number"
              value={topicDraft.sort_order}
              onChange={(e) =>
                setTopicDraft({ ...topicDraft, sort_order: Number(e.target.value) || 0 })
              }
              className={CONTROL}
            />
          </Field>
          <ModalActions
            saving={saving}
            onCancel={() => setTopicDraft(null)}
            onSave={() => void saveTopic()}
          />
        </Modal>
      )}

      {lessonDraft && (
        <Modal title={lessonDraft.id ? "Edit lesson" : "New lesson"} onClose={() => setLessonDraft(null)}>
          <Field label="Title">
            <input
              value={lessonDraft.title}
              onChange={(e) => setLessonDraft({ ...lessonDraft, title: e.target.value })}
              className={CONTROL}
            />
          </Field>
          <Field label="SAT skill">
            <AdminSelect
              value={lessonDraft.topic_id}
              onValueChange={(v) => setLessonDraft({ ...lessonDraft, topic_id: v })}
              options={topics.map((topic) => ({
                value: topic.id,
                label: `${subjects.find((s) => s.id === topic.subject_id)?.title} — ${topic.title}`,
              }))}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Order">
              <input
                type="number"
                value={lessonDraft.sort_order}
                onChange={(e) =>
                  setLessonDraft({ ...lessonDraft, sort_order: Number(e.target.value) || 0 })
                }
                className={CONTROL}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={0}
                value={lessonDraft.duration_minutes}
                onChange={(e) =>
                  setLessonDraft({ ...lessonDraft, duration_minutes: e.target.value })
                }
                className={CONTROL}
              />
            </Field>
          </div>
          <Field label="Direct video URL (mp4). YouTube goes under Recommended.">
            <input
              value={lessonDraft.video_url}
              onChange={(e) => setLessonDraft({ ...lessonDraft, video_url: e.target.value })}
              className={CONTROL}
            />
          </Field>
          <Field label="Or upload a video">
            <input
              type="file"
              accept="video/*"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const path = await uploadLessonVideo(file);
                  setLessonDraft((d) => (d ? { ...d, video_path: path } : d));
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Upload failed");
                } finally {
                  setUploading(false);
                }
              }}
              className="text-sm text-brand-100"
            />
            {lessonDraft.video_path && (
              <p className="mt-1 text-xs text-brand-100">Stored: {lessonDraft.video_path}</p>
            )}
          </Field>
          <Field label="Notes">
            <MixedMathEditor
              value={lessonDraft.body}
              onChange={(body) => setLessonDraft({ ...lessonDraft, body })}
              rows={8}
              placeholder="Explanations, formulas, and practice tips…"
            />
          </Field>
          <label className="inline-flex items-center gap-2 text-sm font-semibold text-white">
            <input
              type="checkbox"
              checked={lessonDraft.published}
              onChange={(e) => setLessonDraft({ ...lessonDraft, published: e.target.checked })}
              className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
            />
            Published
          </label>
          <ModalActions
            saving={saving || uploading}
            onCancel={() => setLessonDraft(null)}
            onSave={() => void saveLesson()}
          />
        </Modal>
      )}

      {recDraft && (
        <Modal title={recDraft.id ? "Edit YouTube" : "Recommended YouTube"} onClose={() => setRecDraft(null)}>
          <Field label="Title">
            <input
              value={recDraft.title}
              onChange={(e) => setRecDraft({ ...recDraft, title: e.target.value })}
              className={CONTROL}
            />
          </Field>
          <Field label="YouTube URL">
            <input
              value={recDraft.youtube_url}
              onChange={(e) => setRecDraft({ ...recDraft, youtube_url: e.target.value })}
              className={CONTROL}
              placeholder="https://www.youtube.com/watch?v=…"
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Order">
              <input
                type="number"
                value={recDraft.sort_order}
                onChange={(e) =>
                  setRecDraft({ ...recDraft, sort_order: Number(e.target.value) || 0 })
                }
                className={CONTROL}
              />
            </Field>
            <Field label="Duration (minutes)">
              <input
                type="number"
                min={0}
                value={recDraft.duration_minutes}
                onChange={(e) =>
                  setRecDraft({ ...recDraft, duration_minutes: e.target.value })
                }
                className={CONTROL}
              />
            </Field>
          </div>
          <ModalActions
            saving={saving}
            onCancel={() => setRecDraft(null)}
            onSave={() => void saveRec()}
          />
        </Modal>
      )}
    </div>
  );
}

function IconBtn({
  children,
  label,
  onClick,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-700 hover:text-white disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-brand-900/60 p-4 backdrop-blur-sm">
      <div className="pop-in my-8 w-full max-w-2xl rounded-2xl border border-brand-400/40 bg-brand-600 shadow-float">
        <div className="flex items-center justify-between border-b border-brand-400/30 px-6 py-4">
          <h3 className="text-lg font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="tap grid h-8 w-8 place-items-center rounded-lg text-brand-100 hover:bg-brand-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-4 p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {children}
    </label>
  );
}

function ModalActions({
  saving,
  onCancel,
  onSave,
}: {
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  return (
    <div className="flex justify-end gap-2 border-t border-brand-400/30 pt-4">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-brand-100 hover:bg-brand-800 hover:text-white"
      >
        Cancel
      </button>
      <button
        type="button"
        disabled={saving}
        onClick={onSave}
        className="rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
