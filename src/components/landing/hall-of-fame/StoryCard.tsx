import { cn } from "@/lib/utils";
import { PersonAvatar } from "./PersonAvatar";
import type { HallStory } from "./schema";
import type { Leaving } from "./useStoryDeck";

/** The card face. Pure layout: the wipe lives on the wrapper in `StoryDeck`. */
function StoryFace({
  story,
  position,
  total,
}: {
  story: HallStory;
  position: number;
  total: number;
}) {
  return (
    <div className="flex h-full flex-col rounded-2xl border border-brand-400/40 bg-brand-600 p-6 text-white shadow-panel md:p-8">
      <div className="flex items-center gap-3">
        <PersonAvatar
          name={story.name}
          photo={story.photo}
          className="h-12 w-12 ring-2 ring-white/40"
          fallbackClassName="text-sm"
        />
        <div className="min-w-0">
          <div className="truncate text-base font-bold">{story.name}</div>
          {story.detail && <div className="truncate text-xs text-brand-100">{story.detail}</div>}
        </div>
        {story.score !== undefined && (
          <div className="ml-auto text-3xl font-black leading-none">{story.score}</div>
        )}
      </div>
      {story.quote && (
        <p className="mt-5 flex-1 text-sm leading-relaxed text-white">“{story.quote}”</p>
      )}
      <div className="mt-5 text-xs text-brand-100">
        {position} / {total}
      </div>
    </div>
  );
}

/** A thin bar that fills over one autoplay interval, so the next swap is never a surprise. */
function Progress({ restartKey, intervalMs }: { restartKey: string; intervalMs: number }) {
  return (
    <div className="absolute inset-x-6 bottom-3 h-0.5 overflow-hidden rounded-full bg-white/15 md:inset-x-8">
      <div
        key={restartKey}
        className="story-progress h-full origin-left rounded-full bg-white/70"
        style={{ animationDuration: `${intervalMs}ms` }}
      />
    </div>
  );
}

/**
 * The current card wipes in over the one it replaces. Both sit in the same grid cell, so the cell
 * keeps the taller of the two and nothing below it jumps while the wipe plays.
 */
export function StoryDeck({
  story,
  position,
  total,
  stamp,
  leaving,
  playing,
  intervalMs,
  progressKey,
  all,
}: {
  /** Every story in the deck. Invisible copies of them size the cell to the tallest card. */
  all: HallStory[];
  story: HallStory;
  position: number;
  total: number;
  stamp: number;
  leaving: Leaving<HallStory> | null;
  playing: boolean;
  intervalMs: number;
  progressKey: string;
}) {
  return (
    <div className="relative grid" aria-live="polite">
      {/* Cards differ in height. Without these the cell resizes on every swap, which shoves the
          page and the orb column around mid-wipe. */}
      {all.map((s, i) => (
        <div key={i} aria-hidden="true" className="invisible col-start-1 row-start-1">
          <StoryFace story={s} position={i + 1} total={total} />
        </div>
      ))}
      {leaving && (
        <div
          key={`out-${leaving.key}`}
          aria-hidden="true"
          className={cn("col-start-1 row-start-1", `story-leave-${leaving.dir}`)}
        >
          <StoryFace story={leaving.item} position={leaving.index + 1} total={total} />
        </div>
      )}
      <div
        key={`in-${stamp}`}
        className={cn("col-start-1 row-start-1", leaving && `story-wipe-${leaving.dir}`)}
      >
        <div className={cn("h-full", leaving && `story-content-${leaving.dir}`)}>
          <StoryFace story={story} position={position} total={total} />
        </div>
      </div>
      {playing && <Progress restartKey={progressKey} intervalMs={intervalMs} />}
    </div>
  );
}
