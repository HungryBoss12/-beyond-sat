import { useEffect, useState } from "react";
import { Play, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import {
  fetchTopRankedVideos,
  fetchYoutubeRecs,
  voteLessonVideo,
} from "@/lib/lessons/client";
import { HUB_TOP_LIMIT, SECTION_REC_LIMIT, voteScoreDelta } from "@/lib/lessons/ranking";
import { formatDuration, youtubeEmbed, youtubeId, youtubeThumb } from "@/lib/lessons/video";
import type { RecommendedVideo, VideoVote } from "@/lib/lessons/types";

export function FeaturedVideos({
  videos: initial,
  heading = "Featured",
  emptyMessage = "No featured videos for this section yet.",
}: {
  videos: RecommendedVideo[];
  heading?: string;
  emptyMessage?: string;
}) {
  const [videos, setVideos] = useState(initial);
  const [watching, setWatching] = useState<RecommendedVideo | null>(null);
  const embed = watching ? youtubeEmbed(watching.youtube_url) : null;

  useEffect(() => {
    setVideos(initial);
  }, [initial]);

  async function onVote(video: RecommendedVideo, intent: 1 | -1) {
    const videoId = video.youtube_video_id || youtubeId(video.youtube_url) || video.id;
    if (!videoId) return;
    const previous = (video.my_vote ?? 0) as VideoVote;
    const next = (previous === intent ? 0 : intent) as VideoVote;
    const delta = voteScoreDelta(previous, next);

    setVideos((list) =>
      list.map((row) =>
        (row.youtube_video_id || row.id) === videoId
          ? { ...row, my_vote: next, score: (row.score ?? 0) + delta, youtube_video_id: videoId }
          : row,
      ),
    );

    try {
      const result = await voteLessonVideo(videoId, next);
      setVideos((list) =>
        list.map((row) =>
          (row.youtube_video_id || row.id) === videoId
            ? { ...row, my_vote: result.my_vote, score: result.score, youtube_video_id: videoId }
            : row,
        ),
      );
    } catch {
      setVideos((list) =>
        list.map((row) =>
          (row.youtube_video_id || row.id) === videoId
            ? { ...row, my_vote: previous, score: (row.score ?? 0) - delta }
            : row,
        ),
      );
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
        {heading}
      </h2>
      {videos.length === 0 ? (
        <p className="text-sm text-slate-500">{emptyMessage}</p>
      ) : (
        <div className="lesson-stagger grid gap-4 sm:grid-cols-2">
          {videos.map((video) => (
            <FeaturedVideoTile
              key={video.id}
              video={video}
              onOpen={() => setWatching(video)}
              onVote={(intent) => void onVote(video, intent)}
            />
          ))}
        </div>
      )}
      {watching && embed && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 p-4 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setWatching(null);
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-2xl bg-black">
            <div className="flex items-center justify-between px-4 py-2">
              <p className="truncate text-sm font-bold text-white">{watching.title}</p>
              <button
                type="button"
                onClick={() => setWatching(null)}
                className="tap grid h-8 w-8 place-items-center text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <iframe
              title={watching.title}
              src={embed}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="aspect-video w-full border-0"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function FeaturedVideoTile({
  video,
  onOpen,
  onVote,
}: {
  video: RecommendedVideo;
  onOpen: () => void;
  onVote: (intent: 1 | -1) => void;
}) {
  const ref = usePointerGlow<HTMLButtonElement>();
  const thumb = youtubeThumb(video.youtube_url);
  const score = video.score ?? 0;
  const myVote = video.my_vote ?? 0;

  return (
    <div className="reveal-surface lift overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 shadow-panel">
      <button
        ref={ref}
        type="button"
        onClick={onOpen}
        className="group w-full text-left"
      >
        <div className="relative aspect-video bg-brand-800">
          {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover opacity-90" /> : null}
          <span className="absolute inset-0 grid place-items-center">
            <span className="grid h-12 w-12 place-items-center rounded-full bg-red-600 text-white shadow-brand">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </span>
          {formatDuration(video.duration_seconds) && (
            <span className="absolute bottom-2 right-2 rounded bg-black/80 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {formatDuration(video.duration_seconds)}
            </span>
          )}
        </div>
        <div className="px-3 pt-3">
          <h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3>
        </div>
      </button>
      <div className="flex items-center gap-1 px-3 pb-3 pt-2">
        <button
          type="button"
          onClick={() => onVote(1)}
          className={`tap inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${
            myVote === 1 ? "bg-white/20 text-white" : "text-brand-100 hover:bg-white/10"
          }`}
          aria-label="Like"
          aria-pressed={myVote === 1}
        >
          <ThumbsUp className={`h-3.5 w-3.5 ${myVote === 1 ? "fill-current" : ""}`} />
          Like
        </button>
        <button
          type="button"
          onClick={() => onVote(-1)}
          className={`tap inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${
            myVote === -1 ? "bg-white/20 text-white" : "text-brand-100 hover:bg-white/10"
          }`}
          aria-label="Dislike"
          aria-pressed={myVote === -1}
        >
          <ThumbsDown className={`h-3.5 w-3.5 ${myVote === -1 ? "fill-current" : ""}`} />
          Dislike
        </button>
        <span className="ml-auto text-xs font-bold text-brand-100" title="Net score">
          {score > 0 ? `+${score}` : score}
        </span>
      </div>
    </div>
  );
}

function VideoStripSkeleton({ heading }: { heading: string }) {
  return (
    <section className="space-y-3">
      <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
        {heading}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="aspect-video animate-pulse rounded-2xl bg-slate-100" />
        <div className="aspect-video animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </section>
  );
}

export function ForYouVideos({ section }: { section?: "rw" | "math" | null }) {
  const [videos, setVideos] = useState<RecommendedVideo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchYoutubeRecs(section ?? null).then((list) => {
      if (!cancelled) setVideos(list.slice(0, SECTION_REC_LIMIT));
    });
    return () => {
      cancelled = true;
    };
  }, [section]);

  if (videos === null) return <VideoStripSkeleton heading="For you" />;

  if (videos.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
          For you
        </h2>
        <p className="text-sm text-slate-500">No YouTube picks right now.</p>
      </section>
    );
  }

  return <FeaturedVideos heading="For you" videos={videos} emptyMessage="No YouTube picks right now." />;
}

export function TopRankedVideos({ limit = HUB_TOP_LIMIT }: { limit?: number }) {
  const [videos, setVideos] = useState<RecommendedVideo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchTopRankedVideos(limit).then((list) => {
      if (!cancelled) setVideos(list.slice(0, limit));
    });
    return () => {
      cancelled = true;
    };
  }, [limit]);

  if (videos === null) return <VideoStripSkeleton heading="Top videos" />;

  if (videos.length === 0) {
    return (
      <section className="space-y-3">
        <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
          Top videos
        </h2>
        <p className="text-sm text-slate-500">No ranked videos yet. Like recommendations to build the list.</p>
      </section>
    );
  }

  return (
    <FeaturedVideos
      heading="Top videos"
      videos={videos}
      emptyMessage="No ranked videos yet. Like recommendations to build the list."
    />
  );
}
