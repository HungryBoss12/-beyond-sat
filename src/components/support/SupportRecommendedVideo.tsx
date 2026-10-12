import { useEffect, useState } from "react";
import { fetchTopRankedVideos } from "@/lib/lessons/client";
import { youtubeEmbed } from "@/lib/lessons/video";

/** One highest-scored lesson video, filling the space beside the attendance grid. */
export function SupportRecommendedVideo() {
  const [title, setTitle] = useState<string | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [empty, setEmpty] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchTopRankedVideos(1)
      .then((videos) => {
        if (!live) return;
        const video = videos[0];
        const embed = video ? youtubeEmbed(video.youtube_url, { autoplay: false }) : null;
        if (!video || !embed) {
          setEmpty(true);
          return;
        }
        setTitle(video.title);
        setSrc(embed);
      })
      .catch(() => {
        if (live) setEmpty(true);
      });
    return () => {
      live = false;
    };
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <p className="text-xs font-bold text-white">Recommended</p>
      {empty ? (
        <p className="mt-2 text-xs font-bold text-white">No recommended video yet.</p>
      ) : src ? (
        <>
          {title && <p className="mt-2 line-clamp-2 text-xs font-bold text-white">{title}</p>}
          <div className="mt-2 aspect-video w-full overflow-hidden rounded-lg">
            <iframe
              className="h-full w-full"
              src={src}
              title={title ?? "Recommended video"}
              allow="picture-in-picture"
              allowFullScreen
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
