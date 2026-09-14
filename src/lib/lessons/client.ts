import { supabase } from "@/integrations/supabase/client";
import { logUinfo } from "@/lib/uinfo/log";
import type {
  Lesson,
  LessonListItem,
  LessonSubject,
  LessonTopic,
  PlayerPayload,
  RecommendedVideo,
  SkillWatch,
  StaffTree,
  SyllabusTopic,
} from "./types";

function err(message: string, error: { message: string } | null) {
  if (!error) return;
  const raw = error.message || message;
  if (/schema cache|does not exist|Could not find the table/i.test(raw)) {
    throw new Error(
      "Lessons tables are not on this database yet. Apply supabase/migrations/20260913000001_lessons_module.sql and 20260913000002_lesson_skills_and_recommended.sql (npm run db:push).",
    );
  }
  throw new Error(raw);
}

export async function listSubjects(): Promise<LessonSubject[]> {
  const { data, error } = await supabase
    .from("lesson_subjects")
    .select("id, slug, title, sort_order, icon")
    .order("sort_order");
  err("Could not load subjects", error);
  return (data ?? []) as LessonSubject[];
}

export async function fetchStaffTree(): Promise<StaffTree> {
  const [subjects, topics, lessons, recommended] = await Promise.all([
    supabase.from("lesson_subjects").select("*").order("sort_order"),
    supabase.from("lesson_topics").select("*").order("sort_order"),
    supabase.from("lessons").select("*").order("sort_order"),
    supabase.from("lesson_recommended_videos").select("*").order("sort_order"),
  ]);
  err("Could not load subjects", subjects.error);
  err("Could not load topics", topics.error);
  err("Could not load lessons", lessons.error);
  err("Could not load recommended videos", recommended.error);
  return {
    subjects: (subjects.data ?? []) as LessonSubject[],
    topics: (topics.data ?? []) as LessonTopic[],
    lessons: (lessons.data ?? []) as Lesson[],
    recommended: (recommended.data ?? []) as RecommendedVideo[],
  };
}

export async function fetchSyllabus(slug: string): Promise<{
  subject: LessonSubject;
  topics: SyllabusTopic[];
  featured: RecommendedVideo[];
} | null> {
  const { data: subject, error: subjectErr } = await supabase
    .from("lesson_subjects")
    .select("id, slug, title, sort_order, icon")
    .eq("slug", slug)
    .maybeSingle();
  err("Could not load subject", subjectErr);
  if (!subject) return null;

  const { data: topics, error: topicErr } = await supabase
    .from("lesson_topics")
    .select("*")
    .eq("subject_id", subject.id)
    .order("sort_order");
  err("Could not load topics", topicErr);

  const topicIds = ((topics ?? []) as LessonTopic[]).map((t) => t.id);
  const { data: user } = await supabase.auth.getUser();
  const [{ data: lessons, error: lessonErr }, progress, featured] = await Promise.all([
    topicIds.length
      ? supabase
          .from("lessons")
          .select("id, topic_id, title, sort_order, duration_seconds, published, video_path")
          .eq("published", true)
          .in("topic_id", topicIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
    user.user
      ? supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.user.id)
      : Promise.resolve({ data: [] as { lesson_id: string }[] }),
    topicIds.length
      ? supabase
          .from("lesson_recommended_videos")
          .select("*")
          .in("topic_id", topicIds)
          .order("sort_order")
      : Promise.resolve({ data: [], error: null }),
  ]);
  err("Could not load lessons", lessonErr);
  err("Could not load featured videos", featured.error);

  const done = new Set((progress.data ?? []).map((p) => p.lesson_id));
  const byTopic = new Map<string, LessonListItem[]>();
  for (const row of (lessons ?? []) as LessonListItem[]) {
    const list = byTopic.get(row.topic_id) ?? [];
    list.push({ ...row, completed: done.has(row.id) });
    byTopic.set(row.topic_id, list);
  }

  return {
    subject: subject as LessonSubject,
    topics: ((topics ?? []) as LessonTopic[]).map((topic) => ({
      ...topic,
      lessons: byTopic.get(topic.id) ?? [],
    })),
    featured: (featured.data ?? []) as RecommendedVideo[],
  };
}

export async function fetchPlayer(
  subjectSlug: string,
  topicId: string,
  lessonId: string,
): Promise<PlayerPayload | null> {
  const { data: subject, error: subjectErr } = await supabase
    .from("lesson_subjects")
    .select("id, slug, title, sort_order, icon")
    .eq("slug", subjectSlug)
    .maybeSingle();
  err("Could not load subject", subjectErr);
  if (!subject) return null;

  const [{ data: topic, error: topicErr }, { data: lesson, error: lessonErr }] = await Promise.all([
    supabase.from("lesson_topics").select("*").eq("id", topicId).maybeSingle(),
    supabase.from("lessons").select("*").eq("id", lessonId).maybeSingle(),
  ]);
  err("Could not load topic", topicErr);
  err("Could not load lesson", lessonErr);
  if (!topic || !lesson || topic.subject_id !== subject.id || lesson.topic_id !== topic.id) {
    return null;
  }

  const { data: playlist, error: listErr } = await supabase
    .from("lessons")
    .select("id, topic_id, title, sort_order, duration_seconds, published, video_path")
    .eq("topic_id", topicId)
    .eq("published", true)
    .order("sort_order");
  err("Could not load playlist", listErr);

  const { data: user } = await supabase.auth.getUser();
  const { data: progress } = user.user
    ? await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("user_id", user.user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle()
    : { data: null };

  const items = (playlist ?? []) as LessonListItem[];
  const idx = items.findIndex((row) => row.id === lessonId);

  return {
    subject: subject as LessonSubject,
    topic: topic as LessonTopic,
    lesson: lesson as Lesson,
    playlist: items,
    prev: idx > 0 ? items[idx - 1] : null,
    next: idx >= 0 && idx < items.length - 1 ? items[idx + 1] : null,
    completed: Boolean(progress),
  };
}

export async function markLessonComplete(lessonId: string) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { error } = await supabase.from("lesson_progress").upsert(
    { user_id: u.user.id, lesson_id: lessonId, completed_at: new Date().toISOString() },
    { onConflict: "user_id,lesson_id" },
  );
  err("Could not save progress", error);
  logUinfo("l", lessonId.slice(0, 8));
}

export async function createTopic(input: {
  subject_id: string;
  title: string;
  description?: string | null;
  sort_order: number;
}) {
  const { error } = await supabase.from("lesson_topics").insert({
    subject_id: input.subject_id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    sort_order: input.sort_order,
  });
  err("Could not create topic", error);
}

export async function updateTopic(
  id: string,
  input: { title: string; description?: string | null; sort_order: number },
) {
  const { error } = await supabase
    .from("lesson_topics")
    .update({
      title: input.title.trim(),
      description: input.description?.trim() || null,
      sort_order: input.sort_order,
    })
    .eq("id", id);
  err("Could not update topic", error);
}

export async function deleteTopic(id: string) {
  const { error } = await supabase.from("lesson_topics").delete().eq("id", id);
  err("Could not delete topic", error);
}

export async function createLesson(input: {
  topic_id: string;
  title: string;
  sort_order: number;
  body?: string;
  video_url?: string | null;
  video_path?: string | null;
  duration_seconds?: number | null;
  published?: boolean;
}) {
  const { error } = await supabase.from("lessons").insert({
    topic_id: input.topic_id,
    title: input.title.trim(),
    sort_order: input.sort_order,
    body: input.body ?? "",
    video_url: input.video_url?.trim() || null,
    video_path: input.video_path || null,
    duration_seconds: input.duration_seconds ?? null,
    published: input.published ?? false,
  });
  err("Could not create lesson", error);
}

export async function updateLesson(
  id: string,
  input: {
    topic_id: string;
    title: string;
    sort_order: number;
    body: string;
    video_url: string | null;
    video_path: string | null;
    duration_seconds: number | null;
    published: boolean;
  },
) {
  const { error } = await supabase
    .from("lessons")
    .update({
      topic_id: input.topic_id,
      title: input.title.trim(),
      sort_order: input.sort_order,
      body: input.body,
      video_url: input.video_url?.trim() || null,
      video_path: input.video_path || null,
      duration_seconds: input.duration_seconds,
      published: input.published,
    })
    .eq("id", id);
  err("Could not update lesson", error);
}

export async function deleteLesson(id: string) {
  const { error } = await supabase.from("lessons").delete().eq("id", id);
  err("Could not delete lesson", error);
}

export async function swapSortOrder(
  table: "lesson_topics" | "lessons" | "lesson_recommended_videos",
  a: { id: string; sort_order: number },
  b: { id: string; sort_order: number },
) {
  const first = await supabase.from(table).update({ sort_order: b.sort_order }).eq("id", a.id);
  err("Could not reorder", first.error);
  const second = await supabase.from(table).update({ sort_order: a.sort_order }).eq("id", b.id);
  err("Could not reorder", second.error);
}

export async function fetchSkillWatch(subjectSlug: string, topicId: string): Promise<SkillWatch | null> {
  const syllabus = await fetchSyllabus(subjectSlug);
  if (!syllabus) return null;
  const topic = syllabus.topics.find((t) => t.id === topicId);
  if (!topic) return null;
  const { data, error } = await supabase
    .from("lesson_recommended_videos")
    .select("*")
    .eq("topic_id", topicId)
    .order("sort_order");
  err("Could not load recommended videos", error);
  return {
    subject: syllabus.subject,
    topic,
    lessons: topic.lessons,
    recommended: (data ?? []) as RecommendedVideo[],
  };
}

export async function createRecommended(input: {
  topic_id: string;
  title: string;
  youtube_url: string;
  sort_order: number;
  duration_seconds?: number | null;
}) {
  const { error } = await supabase.from("lesson_recommended_videos").insert({
    topic_id: input.topic_id,
    title: input.title.trim(),
    youtube_url: input.youtube_url.trim(),
    sort_order: input.sort_order,
    duration_seconds: input.duration_seconds ?? null,
  });
  err("Could not add recommended video", error);
}

export async function updateRecommended(
  id: string,
  input: { title: string; youtube_url: string; sort_order: number; duration_seconds?: number | null },
) {
  const { error } = await supabase
    .from("lesson_recommended_videos")
    .update({
      title: input.title.trim(),
      youtube_url: input.youtube_url.trim(),
      sort_order: input.sort_order,
      duration_seconds: input.duration_seconds ?? null,
    })
    .eq("id", id);
  err("Could not update recommended video", error);
}

export async function deleteRecommended(id: string) {
  const { error } = await supabase.from("lesson_recommended_videos").delete().eq("id", id);
  err("Could not delete recommended video", error);
}

export async function fetchYoutubeRecs(): Promise<RecommendedVideo[]> {
  const token = (await supabase.auth.getSession()).data.session?.access_token;
  if (!token) return [];
  try {
    const response = await fetch("/api/ai/youtube-recs", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!response.ok) return [];
    const data = (await response.json()) as {
      videos?: {
        title?: string;
        url?: string;
        videoId?: string;
        durationSeconds?: number | null;
      }[];
    };
    return (data.videos ?? [])
      .filter((video) => video.videoId && video.title && video.url)
      .slice(0, 5)
      .map((video) => ({
        id: video.videoId as string,
        topic_id: "",
        title: video.title as string,
        youtube_url: video.url as string,
        sort_order: 0,
        duration_seconds: video.durationSeconds ?? null,
      }));
  } catch {
    return [];
  }
}
