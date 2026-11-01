import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { BeyondCore } from "@/components/landing/BeyondCore";
import { useInView } from "@/hooks/useInView";
import { cn } from "@/lib/utils";
import type { HallStory } from "./schema";
import { StoryDeck } from "./StoryCard";
import { useOnScreen, useStoryDeck } from "./useStoryDeck";

/** How long each story stays up before the next one wipes in. */
const STORY_MS = 6500;

/**
 * The story panel: a visual on the left and a student story on the right.
 *
 * The visual is the BeyondCore orb. It is the one piece meant to be swapped when the final example
 * arrives, so everything that is not the orb stays in `StoryDeck` and the chips below.
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

  return (
    <div
      ref={ref}
      className="grid items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:gap-10"
    >
      <Visual variant={deck.index} />
      <div className="space-y-4">
        {countries.length > 1 && (
          <Chips options={["All", ...countries]} active={country} onPick={pick} />
        )}
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
        {visible.length > 1 && (
          <div className="flex gap-2">
            <StepButton dir="prev" onClick={() => deck.go(-1)} />
            <StepButton dir="next" onClick={() => deck.go(1)} />
          </div>
        )}
      </div>
    </div>
  );
}
