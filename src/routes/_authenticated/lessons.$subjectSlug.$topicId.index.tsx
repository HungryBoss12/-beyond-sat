import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Play } from "lucide-react";
import { LessonPageHead, sectionKind } from "@/components/lessons/LessonSectionMark";
import { Panel } from "@/components/ui/panel";
import { CardGridSkeleton, HeadSkeleton } from "@/components/ui/skeletons";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { fetchSkillWatch } from "@/lib/lessons/client";
import { LESSON_UPLOADS_BUCKET, resolveDisplayUrl } from "@/lib/storage-url";
import { formatDuration } from "@/lib/lessons/video";
import type { LessonListItem, SkillWatch } from "@/lib/lessons/types";

export const Route = createFileRoute("/_authenticated/lessons/$subjectSlug/$topicId/")({
  component: SkillWatchPage,
});

function SkillWatchPage() {
  const { subjectSlug, topicId } = Route.useParams();
  const [data, setData] = useState<SkillWatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchSkillWatch(subjectSlug, topicId)
      .then((next) => {
        if (cancelled) return;
        if (!next) {
          setError("Skill not found.");
          return;
        }
        setData(next);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load videos");
      });
    return () => {
      cancelled = true;
    };
  }, [subjectSlug, topicId]);

  if (error && !data) {
    return (
      <div className="relative isolate mx-auto max-w-5xl space-y-4">
        <LessonPageHead kind={sectionKind(subjectSlug)} title="Lessons" />
        <Panel className="p-5 text-sm text-brand-100">{error}</Panel>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <HeadSkeleton />
        <CardGridSkeleton count={6} height={180} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-12">
      <Link
        to="/lessons/$subjectSlug"
        params={{ subjectSlug }}
        className="lesson-back-enter nudge group inline-flex items-center gap-1.5 text-sm font-semibold text-slate-600 hover:text-brand-600"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-0.5" />
        {data.subject.title}
      </Link>
      <LessonPageHead
        kind={sectionKind(subjectSlug)}
        title={data.topic.title}
        subtitle={data.topic.description ?? "Taught walkthroughs for this skill."}
      />

      {data.lessons.length === 0 ? (
        <p className="text-sm text-slate-500">No published lessons for this skill yet.</p>
      ) : (
        <div className="lesson-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.lessons.map((lesson) => (
            <LessonTile
              key={lesson.id}
              lesson={lesson}
              subjectSlug={subjectSlug}
              topicId={topicId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonTile({
  lesson,
  subjectSlug,
  topicId,
}: {
  lesson: LessonListItem;
  subjectSlug: string;
  topicId: string;
}) {
  const ref = usePointerGlow<HTMLAnchorElement>();
  return (
    <Link
      ref={ref}
      to="/lessons/$subjectSlug/$topicId/$lessonId"
      params={{ subjectSlug, topicId, lessonId: lesson.id }}
      className="reveal-surface lift group block overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel"
    >
      <LessonPoster lesson={lesson} />
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-white">{lesson.title}</h3>
        <p className="mt-1 text-xs text-brand-100">
          {lesson.completed ? "Completed" : "BeyondSAT lesson"}
        </p>
      </div>
    </Link>
  );
}

function LessonPoster({ lesson }: { lesson: LessonListItem }) {
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!lesson.video_path) return;
    let cancelled = false;
    void resolveDisplayUrl(lesson.video_path, LESSON_UPLOADS_BUCKET).then((url) => {
      if (!cancelled) setSrc(url);
    });
    return () => {
      cancelled = true;
    };
  }, [lesson.video_path]);

  return (
    <div className="relative aspect-video bg-brand-800">
      {src ? (
        <video
          src={src}
          muted
          preload="metadata"
          playsInline
          className="absolute inset-0 h-full w-full object-cover opacity-80"
        />
      ) : null}
      <div className="absolute inset-0 grid place-items-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-white/95 text-brand-600 shadow-brand">
          <Play className="h-5 w-5 fill-current" />
        </span>
      </div>
      {formatDuration(lesson.duration_seconds) && (
        <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white">
          {formatDuration(lesson.duration_seconds)}
        </span>
      )}
    </div>
  );
}
