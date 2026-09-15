import { useEffect, useRef, useState } from "react";
import { Maximize, Pause, Play } from "lucide-react";

export function LessonVideoPlayer({ src, title }: { src: string; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => {
      setCurrent(el.currentTime);
      setDuration(el.duration || 0);
      setProgress(el.duration ? el.currentTime / el.duration : 0);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onTime);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onTime);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
    };
  }, [src]);

  function toggle() {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }

  function seek(value: number) {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    el.currentTime = value * el.duration;
  }

  return (
    <div className="group/player relative overflow-hidden rounded-2xl bg-slate-950">
      <video
        ref={videoRef}
        src={src}
        title={title}
        className="aspect-video w-full"
        onClick={toggle}
        playsInline
      />
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-10">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="Seek"
          className="mb-2 h-1 w-full cursor-pointer accent-brand-200"
        />
        <div className="flex items-center gap-3 text-white">
          <button type="button" onClick={toggle} aria-label={playing ? "Pause" : "Play"} className="tap">
            {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </button>
          <span className="text-xs font-semibold tabular-nums text-white/80">
            {stamp(current)} / {stamp(duration)}
          </span>
          <span className="flex-1" />
          <button
            type="button"
            aria-label="Fullscreen"
            className="tap"
            onClick={() => void videoRef.current?.requestFullscreen?.()}
          >
            <Maximize className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function stamp(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
