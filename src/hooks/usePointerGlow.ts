import { useEffect, useState, type RefCallback } from "react";

/**
 * Writes the pointer's position, relative to the returned element, into two CSS
 * custom properties: `--px` and `--py` (both in px, from the element's top-left).
 *
 * Why custom properties rather than React state: a `pointermove` handler that
 * calls `setState` re-renders the subtree on every mouse event. Writing straight
 * to `style` skips React entirely, so the effect costs one style mutation per
 * animation frame no matter how many cards are on screen.
 *
 * Coalesced through `requestAnimationFrame` — pointer events fire faster than the
 * compositor paints, so anything more often than once per frame is wasted work.
 *
 * No-ops under `prefers-reduced-motion: reduce`. The gradients keyed to these
 * variables fall back to their unset state, which the `@utility` definitions in
 * styles.css treat as "centred and invisible".
 *
 * The ref is a callback so a late-mounted node (conditional footer, tab panel)
 * still binds. An empty-deps `useRef` + `useEffect` would see `null` on the
 * first pass and never attach.
 */
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>(): RefCallback<T> {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    const flush = () => {
      frame = 0;
      el.style.setProperty("--px", `${pendingX}px`);
      el.style.setProperty("--py", `${pendingY}px`);
    };

    const writePos = (clientX: number, clientY: number) => {
      const rect = el.getBoundingClientRect();
      pendingX = clientX - rect.left;
      pendingY = clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onEnter = (e: PointerEvent) => {
      writePos(e.clientX, e.clientY);
      el.style.setProperty("--glow", "1");
    };

    const onMove = (e: PointerEvent) => writePos(e.clientX, e.clientY);

    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--glow", "0");
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, [el]);

  return setEl;
}

/**
 * Viewport-level variant: tracks the pointer across the whole window and writes
 * `--gx` / `--gy` onto the returned element, which is expected to be a fixed
 * overlay. Used for the page-level ambient spotlight.
 *
 * Coordinates stay viewport-absolute so they match `position: fixed`. The
 * overlay must NOT sit inside an ancestor with a `transform` (AppShell's
 * `route-enter` animation) — that ancestor becomes the containing block and
 * the glow collapses to the content column, then stacks behind white paint.
 */
export function useAmbientGlow<T extends HTMLElement = HTMLDivElement>(): RefCallback<T> {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    const flush = () => {
      frame = 0;
      el.style.setProperty("--gx", `${pendingX}px`);
      el.style.setProperty("--gy", `${pendingY}px`);
      el.style.setProperty("--glow", "1");
    };

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onLeaveWindow = (e: PointerEvent) => {
      if (e.relatedTarget != null) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--glow", "0");
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
    };
  }, [el]);

  return setEl;
}
