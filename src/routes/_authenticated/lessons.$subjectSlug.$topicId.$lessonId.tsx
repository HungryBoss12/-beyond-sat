import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Clock } from "lucide-react";
import { MathText } from "@/components/MathText";
import { LessonVideoPlayer } from "@/components/lessons/LessonVideoPlayer";
import { fetchPlayer, markLessonComplete } from "@/lib/lessons/client";
import { formatDuration, resolveLessonVideo } from "@/lib/lessons/video";
import type { LessonVideo, PlayerPayload } from "@/lib/lessons/types";

export const Route = createFileRoute("/_authenticated/lessons/$subjectSlug/$topicId/$lessonId")({
  component: LessonPlayer,
  head: () => ({ meta: [{ title: "Lesson — BeyondSAT" }] }),
});

function LessonPlayer() {
  const params = Route.useParams();
  const [payload, setPayload] = useState<PlayerPayload | null>(null);
  const [video, setVideo] = useState<LessonVideo>({ kind: "none" });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPayload(null);
    void fetchPlayer(params.subjectSlug, params.topicId, params.lessonId)
      .then(async (data) => {
        if (cancelled) return;
        if (!data) {
          setError("Lesson not found.");
          return;
        }
        setPayload(data);
        setVideo(await resolveLessonVideo(data.lesson));
        setError(null);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load lesson");
      });
    return () => {
      cancelled = true;
    };
  }, [params.subjectSlug, params.topicId, params.lessonId]);

  async function complete() {
    if (!payload) return;
    setSaving(true);
    try {
      await markLessonComplete(payload.lesson.id);
      setPayload({ ...payload, completed: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save progress");
    } finally {
      setSaving(false);
    }
  }

  if (error && !payload) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white p-6">
        <p className="text-sm font-semibold text-slate-600">{error}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-white text-sm text-slate-500">
        Loading lesson…
      </div>
    );
  }

  const playerLink = (lessonId: string) => ({
    to: "/lessons/$subjectSlug/$topicId/$lessonId" as const,
    params: {
      subjectSlug: payload.subject.slug,
      topicId: payload.topic.id,
      lessonId,
    },
  });

  return (
    <div className="flex min-h-[100dvh] flex-col bg-white text-slate-900 lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-brand-400/20 px-4">
          <Link
            to="/lessons/$subjectSlug/$topicId"
            params={{ subjectSlug: payload.subject.slug, topicId: payload.topic.id }}
            className="tap inline-flex items-center gap-1.5 text-sm font-semibold text-brand-600 hover:text-brand-400"
          >
            <ArrowLeft className="h-4 w-4" />
            {payload.topic.title}
          </Link>
          <span className="truncate text-sm text-slate-500">{payload.topic.title}</span>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-6">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">
              {payload.lesson.title}
            </h1>
            {formatDuration(payload.lesson.duration_seconds) && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                {formatDuration(payload.lesson.duration_seconds)}
              </p>
            )}

            {video.kind === "file" ? (
              <div className="mt-5">
                <LessonVideoPlayer src={video.src} title={payload.lesson.title} />
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-brand-25 px-4 py-3 text-sm text-slate-600">
                This lesson does not have an uploaded video yet. Staff can attach a file in Admin →
                Lessons. YouTube links belong under Recommended on the skill page.
              </p>
            )}

            {payload.lesson.body.trim() && (
              <div className="mt-6 text-sm leading-relaxed text-slate-700">
                <MathText block className="ai-prose">
                  {payload.lesson.body}
                </MathText>
              </div>
            )}

            {error && <p className="mt-4 text-sm font-semibold text-slate-600">{error}</p>}

            <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
              {payload.prev ? (
                <Link
                  {...playerLink(payload.prev.id)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <button
                type="button"
                disabled={payload.completed || saving}
                onClick={() => void complete()}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-25 px-4 py-2 text-sm font-bold text-brand-600 ring-1 ring-brand-400/30 disabled:opacity-60"
              >
                <Check className="h-4 w-4" />
                {payload.completed ? "Completed" : saving ? "Saving…" : "Mark complete"}
              </button>
              {payload.next ? (
                <Link
                  {...playerLink(payload.next.id)}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-brand-600"
                >
                  Next
                  <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <span />
              )}
            </div>
          </div>
        </div>
      </div>

      <aside className="w-full shrink-0 border-t border-brand-400/20 bg-brand-25 lg:w-80 lg:border-t-0 lg:border-l">
        <div className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-slate-500">
          {payload.topic.title}
        </div>
        <nav className="px-2 pb-4">
          {payload.playlist.map((item) => {
            const active = item.id === payload.lesson.id;
            return (
              <Link
                key={item.id}
                {...playerLink(item.id)}
                className={
                  "mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-sm " +
                  (active
                    ? "bg-white font-bold text-brand-600 ring-1 ring-brand-400/30"
                    : "text-slate-700 hover:bg-white")
                }
              >
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                {formatDuration(item.duration_seconds) && (
                  <span className="text-[11px] text-slate-400">
                    {formatDuration(item.duration_seconds)}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
    </div>
  );
}
