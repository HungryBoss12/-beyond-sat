import { useCallback, useEffect, useRef, useState } from "react";

export type DeckDirection = "next" | "prev";
export type Leaving<T> = { item: T; index: number; dir: DeckDirection; key: number };

/** Long enough for the wipe in styles.css (`story-wipe-*`) to finish before the old card is dropped. */
export const WIPE_MS = 900;

/**
 * True while the element is on screen. Unlike `useInView` this tracks leaving as well as entering,
 * because autoplay should stop when nobody can see it.
 */
export function useOnScreen<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [onScreen, setOnScreen] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting), {
      threshold: 0.2,
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return { ref, onScreen };
}

/** True while the tab is in the foreground; a background tab should not keep swapping stories. */
function useTabVisible() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== "hidden");
    update();
    document.addEventListener("visibilitychange", update);
    return () => document.removeEventListener("visibilitychange", update);
  }, []);
  return visible;
}

/** True when the visitor asked the OS for less motion. Read once; it rarely changes mid-visit. */
function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (!window.matchMedia) return;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

/**
 * A deck that advances on its own and keeps the card it just left around long enough to animate out.
 *
 * Autoplay restarts its full interval after every change, manual or automatic, so pressing next
 * never leads straight into a second swap. It stops while `hold` is true (pointer or focus on the
 * card), while the tab is hidden, while the deck is off screen, and for good under reduced motion.
 */
export function useStoryDeck<T>(items: T[], intervalMs: number, hold: boolean, onScreen: boolean) {
  const [index, setIndex] = useState(0);
  const [leaving, setLeaving] = useState<Leaving<T> | null>(null);
  const [stamp, setStamp] = useState(0);
  const counter = useRef(0);
  const tabVisible = useTabVisible();
  const reduced = usePrefersReducedMotion();

  const count = items.length;
  const safeIndex = count > 0 ? index % count : 0;
  const playing = count > 1 && !hold && onScreen && tabVisible && !reduced;

  const go = useCallback(
    (delta: number) => {
      if (count < 2) return;
      counter.current += 1;
      setStamp(counter.current);
      setLeaving({
        item: items[safeIndex],
        index: safeIndex,
        dir: delta < 0 ? "prev" : "next",
        key: counter.current,
      });
      setIndex((safeIndex + delta + count) % count);
    },
    [items, safeIndex, count],
  );

  const reset = useCallback(() => {
    counter.current += 1;
    setStamp(counter.current);
    setLeaving(null);
    setIndex(0);
  }, []);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setLeaving(null), WIPE_MS);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(1), intervalMs);
    return () => window.clearTimeout(timer);
  }, [playing, go, intervalMs]);

  return {
    index: safeIndex,
    stamp,
    current: items[safeIndex] as T | undefined,
    leaving,
    go,
    reset,
    playing,
  };
}
