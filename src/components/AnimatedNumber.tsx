import { useEffect, useRef, useState } from "react";

/**
 * A number that tweens whenever its value changes.
 *
 * Differs from {@link ../components/CountUp CountUp} in two ways that matter for
 * live app surfaces: it starts as soon as it mounts (no scroll observer, since
 * dashboard panels are above the fold anyway), and it re-runs on every change of
 * `value` — counting *from the previous value*, not from zero. That makes a
 * score moving 1380 -> 1450 read as an increment rather than a fresh reveal.
 *
 * Honours `prefers-reduced-motion` by jumping straight to the final value.
 */
export function AnimatedNumber({
  value,
  duration = 900,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  // The value we're tweening away from. Held in a ref so changing it mid-flight
  // doesn't schedule another render.
  const fromRef = useRef(value);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const from = fromRef.current;
    const to = value;
    if (from === to) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduced || duration <= 0) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      // easeOutCubic: fast out of the gate, settles gently on the target.
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (to - from) * eased;
      setDisplay(next);
      if (p < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    };
    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
      // Adopt wherever we stopped, so an interrupted tween continues from the
      // visible number instead of snapping back.
      fromRef.current = display;
    };
    // `display` is intentionally omitted: including it would restart the tween
    // on every animation frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, duration]);

  const shown =
    decimals > 0
      ? display.toFixed(decimals)
      : Math.round(display).toLocaleString();

  return (
    <span className={className} style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
