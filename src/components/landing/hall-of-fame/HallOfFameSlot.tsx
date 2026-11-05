import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BeyondCore } from "@/components/landing/BeyondCore";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./PersonAvatar";
import type { HallStory } from "./schema";
import { StoryDeck } from "./StoryCard";
import { useOnScreen, useStoryDeck } from "./useStoryDeck";

/** How long each story stays up before the next one wipes in. */
const STORY_MS = 6500;

/**
 * The story panel: the orb in the middle, with each result floating around it.
 *
 * The orb is the BeyondCore emblem. It is the one piece meant to be swapped when the final example
 * arrives, so everything that is not the orb stays in the cards below.
 *
 * The orb mounts only once the panel is on screen. The hero already runs a WebGL scene, and a second
 * one should not start while it is far below the fold. BeyondCore still brings its own fallbacks
 * (reduced motion, no WebGL, narrow screens), and the column is hidden under `md` so a phone does
 * not get a second dashboard mockup. Here it is interactive (drag to spin) and changes shape and
 * colour whenever the story changes.
 */
function Visual({ variant }: { variant: number }) {
  const { ref, inView } = useInView<HTMLDivElement>("200px 0px");
  const wide = useWideScreen();
  /* Not mounted at all on a narrow screen. BeyondCore falls back to the dashboard mockup there, and
     a mockup (with its charts) inside a display:none box measures 0x0 and logs chart warnings. */
  return (
    <div ref={ref} className="hidden md:block">
      {inView && wide && <BeyondCore interactive variant={variant} />}
    </div>
  );
}

function useWideScreen() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setWide(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return wide;
}

function Chips({
  options,
  active,
  onPick,
}: {
  options: string[];
  active: string;
  onPick: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          aria-pressed={c === active}
          className={cn(
            "tap rounded-full border px-3 py-1 text-xs font-bold transition",
            c === active
              ? "border-brand-600 bg-brand-600 text-white"
              : "border-brand-400/40 bg-white text-brand-700 hover:bg-brand-50",
          )}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

/** Where card `index` sits while `active` is the one on the right. Evenly spaced around the centre. */
function orbitStyle(index: number, active: number, count: number): { left: string; top: string } {
  const turn = count > 0 ? ((index - active) / count) * Math.PI * 2 : 0;
  return {
    left: `${50 + Math.cos(turn) * 36}%`,
    top: `${50 + Math.sin(turn) * 34}%`,
  };
}

function OrbitCard({
  story,
  index,
  active,
  count,
  onPick,
}: {
  story: HallStory;
  index: number;
  active: number;
  count: number;
  onPick: () => void;
}) {
  const on = index === active;
  return (
    <div
      className="story-orbit absolute z-20"
      style={{ ...orbitStyle(index, active, count), animationDelay: `${index * 0.6}s` }}
    >
      <button
        type="button"
        onClick={onPick}
        aria-current={on ? "true" : undefined}
        className={cn(
          "block rounded-2xl border border-white/15 bg-brand-600 text-left text-white shadow-panel transition-[width,padding] duration-700",
          on ? "w-64 p-4 ring-2 ring-white/80" : "w-48 p-3 opacity-90 hover:opacity-100",
        )}
      >
        <span className="flex items-center gap-2.5">
          <PersonAvatar
            name={story.name}
            photo={story.photo}
            className="h-9 w-9 shrink-0 ring-2 ring-white/30"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-bold">{story.name}</span>
            {story.detail && (
              <span className="block truncate text-[11px] text-brand-100">{story.detail}</span>
            )}
          </span>
          {story.score !== undefined && (
            <span className="text-xl font-black leading-none">{story.score}</span>
          )}
        </span>
        {on && story.quote && (
          <span className="mt-3 line-clamp-3 block text-xs leading-relaxed text-white">
            “{story.quote}”
          </span>
        )}
      </button>
    </div>
  );
}

function StepButton({ dir, onClick }: { dir: "prev" | "next"; onClick: () => void }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === "prev" ? "Previous story" : "Next story"}
      className="tap grid h-9 w-9 place-items-center rounded-full border border-brand-400/40 bg-white text-brand-700 hover:bg-brand-50"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

export function HallOfFameSlot({ stories }: { stories: HallStory[] }) {
  const countries = useMemo(
    () => [...new Set(stories.map((s) => s.country).filter(Boolean))],
    [stories],
  );
  const [country, setCountry] = useState("All");
  const [hold, setHold] = useState(false);
  const { ref, onScreen } = useOnScreen<HTMLDivElement>();

  const visible = useMemo(
    () => (country === "All" ? stories : stories.filter((s) => s.country === country)),
    [stories, country],
  );
  const deck = useStoryDeck(visible, STORY_MS, hold, onScreen);

  const pick = (value: string) => {
    setCountry(value);
    deck.reset();
  };

  const focusStory = (index: number) => {
    const count = visible.length;
    if (count < 2 || index === deck.index) return;
    const forward = (index - deck.index + count) % count;
    const back = count - forward;
    deck.go(forward <= back ? forward : -back);
  };

  return (
    <div ref={ref} className="space-y-4">
      {countries.length > 1 && (
        <Chips options={["All", ...countries]} active={country} onPick={pick} />
      )}
      {/* Desktop: the cards ride an ellipse around the orb and glide to a new spot on each story. */}
      <div
        className="relative mx-auto hidden h-[40rem] max-w-5xl md:block"
        onPointerEnter={() => setHold(true)}
        onPointerLeave={() => setHold(false)}
      >
        <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center">
          <div className="pointer-events-auto w-full max-w-sm">
            <Visual variant={deck.index} />
          </div>
        </div>
        {visible.map((story, i) => (
          <OrbitCard
            key={`${story.name}-${i}`}
            story={story}
            index={i}
            active={deck.index}
            count={visible.length}
            onPick={() => focusStory(i)}
          />
        ))}
      </div>
      <div className="space-y-4 md:hidden">
        {deck.current && (
          /* Hovering or focusing the card holds autoplay, so a story can be read without it leaving. */
          <div
            onPointerEnter={() => setHold(true)}
            onPointerLeave={() => setHold(false)}
            onFocus={() => setHold(true)}
            onBlur={() => setHold(false)}
          >
            <StoryDeck
              story={deck.current}
              position={deck.index + 1}
              total={visible.length}
              stamp={deck.stamp}
              leaving={deck.leaving}
              playing={deck.playing}
              intervalMs={STORY_MS}
              progressKey={`${deck.stamp}`}
              all={visible}
            />
          </div>
        )}
      </div>
      {visible.length > 1 && (
        <div className="flex justify-center gap-2">
          <StepButton dir="prev" onClick={() => deck.go(-1)} />
          <StepButton dir="next" onClick={() => deck.go(1)} />
        </div>
      )}
    </div>
  );
}
