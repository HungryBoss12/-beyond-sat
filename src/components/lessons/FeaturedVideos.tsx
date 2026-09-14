import { useEffect, useState } from "react";
import { Play, X } from "lucide-react";
import { usePointerGlow } from "@/hooks/usePointerGlow";
import { fetchYoutubeRecs } from "@/lib/lessons/client";
import { formatDuration, youtubeEmbed, youtubeThumb } from "@/lib/lessons/video";
import type { RecommendedVideo } from "@/lib/lessons/types";

export function FeaturedVideos({
  videos,
  heading = "Featured",
}: {
  videos: RecommendedVideo[];
  heading?: string;
}) {
  const [watching, setWatching] = useState<RecommendedVideo | null>(null);
  const embed = watching ? youtubeEmbed(watching.youtube_url) : null;

  return (
    <section className="space-y-3">
      <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
        {heading}
      </h2>
      {videos.length === 0 ? (
        <p className="text-sm text-slate-500">No featured videos for this section yet.</p>
      ) : (
        <div className="lesson-stagger grid gap-4 sm:grid-cols-2">
          {videos.map((video) => (
            <FeaturedVideoTile key={video.id} video={video} onOpen={() => setWatching(video)} />
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
}: {
  video: RecommendedVideo;
  onOpen: () => void;
}) {
  const ref = usePointerGlow<HTMLButtonElement>();
  const thumb = youtubeThumb(video.youtube_url);
  return (
    <button
      ref={ref}
      type="button"
      onClick={onOpen}
      className="reveal-surface lift group w-full overflow-hidden rounded-2xl border border-brand-400/40 bg-brand-600 text-left shadow-panel"
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
      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-bold text-white">{video.title}</h3>
        <p className="mt-1 text-xs text-brand-100">YouTube</p>
      </div>
    </button>
  );
}

export function ForYouVideos() {
  const [videos, setVideos] = useState<RecommendedVideo[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetchYoutubeRecs().then((list) => {
      if (!cancelled) setVideos(list.slice(0, 5));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (videos === null) {
    return (
      <section className="space-y-3">
        <h2 className="lesson-copy-enter text-sm font-bold uppercase tracking-wider text-slate-500">
          For you
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="aspect-video animate-pulse rounded-2xl bg-slate-100" />
          <div className="aspect-video animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </section>
    );
  }

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

  return <FeaturedVideos heading="For you" videos={videos} />;
}
