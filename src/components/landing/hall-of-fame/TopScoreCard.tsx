import type { CSSProperties } from "react";
import { useInView } from "@/hooks/useInView";
import type { HallTop } from "./schema";

/**
 * The highest score, set as type.
 *
 * Each digit rolls into place with a short stagger. That is an entrance, not a live counter.
 */
function Digit({ value, index, play }: { value: number; index: number; play: boolean }) {
  const settled = { transform: `translateY(calc(${value} * -1em))` };
  return (
    <span className="inline-block h-[1em] overflow-hidden">
      <span
        className={play ? "score-digit-roll block" : "block"}
        style={
          play
            ? ({ animationDelay: `${index * 90}ms`, "--digit": value } as CSSProperties)
            : settled
        }
      >
        {Array.from({ length: 10 }, (_, n) => (
          <span key={n} className="block h-[1em]">
            {n}
          </span>
        ))}
      </span>
    </span>
  );
}

export function TopScoreCard({ top }: { top: HallTop }) {
  const { ref, inView } = useInView<HTMLDivElement>("-8% 0px");
  const digits = String(top.score)
    .split("")
    .map((d) => Number(d));

  return (
    <div ref={ref} className="py-1">
      <div
        className="mt-4 text-7xl font-light leading-none tracking-tighter text-brand-700 tabular-nums md:text-8xl"
        aria-hidden="true"
      >
        {digits.map((digit, i) => (
          <Digit key={i} value={digit} index={i} play={inView} />
        ))}
      </div>
      <p className="sr-only">{top.score}</p>
      <div
        className={
          inView ? "score-rule mt-5 h-px bg-brand-600/30" : "mt-5 h-px w-16 bg-brand-600/30"
        }
      />
      <div
        className={
          inView
            ? "score-name mt-4 truncate text-base font-medium text-slate-900"
            : "mt-4 truncate text-base font-medium text-slate-900"
        }
      >
        {top.name}
      </div>
      {top.caption && (
        <div
          className={
            inView
              ? "score-name mt-1 truncate text-sm text-slate-500"
              : "mt-1 truncate text-sm text-slate-500"
          }
        >
          {top.caption}
        </div>
      )}
    </div>
  );
}
