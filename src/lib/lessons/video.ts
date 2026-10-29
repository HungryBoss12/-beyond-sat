import { LESSON_UPLOADS_BUCKET, resolveDisplayUrl } from "@/lib/storage-url";
import type { Lesson, LessonVideo } from "./types";

export function youtubeId(url: string): string | null {
  const u = url.trim();
  const watch = u.match(/[?&]v=([\w-]{6,})/);
  if (watch) return watch[1];
  const short = u.match(/youtu\.be\/([\w-]{6,})/);
  if (short) return short[1];
  const embed = u.match(/youtube\.com\/embed\/([\w-]{6,})/);
  if (embed) return embed[1];
  const shorts = u.match(/youtube\.com\/shorts\/([\w-]{6,})/);
  return shorts?.[1] ?? null;
}

function vimeoId(url: string): string | null {
  const match = url.trim().match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return match?.[1] ?? null;
}

/** Official lessons use our HTML5 player only — no YouTube iframe. */
export async function resolveLessonVideo(lesson: Pick<Lesson, "video_url" | "video_path">): Promise<LessonVideo> {
  if (lesson.video_path) {
    const src = await resolveDisplayUrl(lesson.video_path, LESSON_UPLOADS_BUCKET);
    if (src) return { kind: "file", src };
  }

  const raw = (lesson.video_url ?? "").trim();
  if (!raw) return { kind: "none" };
  if (youtubeId(raw) || vimeoId(raw)) return { kind: "none" };
  if (/^https?:\/\//i.test(raw)) return { kind: "file", src: raw };
  return { kind: "none" };
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

function embedOrigin(): string | null {
  if (typeof window === "undefined" || window.location.protocol === "file:") return null;
  return window.location.origin;
}

export function youtubeEmbed(url: string, options?: { autoplay?: boolean }): string | null {
  const id = youtubeId(url);
  if (!id) return null;
  const params = new URLSearchParams();
  if (options?.autoplay !== false) params.set("autoplay", "1");
  const origin = embedOrigin();
  if (origin) params.set("origin", origin);
  const query = params.toString();
  return `https://www.youtube-nocookie.com/embed/${id}${query ? `?${query}` : ""}`;
}

/** A playlist embed. origin is required or Firefox tries a file:// fallback. */
export function youtubePlaylistEmbed(url: string): string | null {
  const list = /[?&]list=([^&]+)/.exec(url.trim())?.[1];
  if (!list) return null;
  const params = new URLSearchParams({ list });
  const origin = embedOrigin();
  if (origin) params.set("origin", origin);
  return `https://www.youtube-nocookie.com/embed/videoseries?${params.toString()}`;
}

export function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  const mins = Math.max(1, Math.round(seconds / 60));
  return `${mins} min`;
}
