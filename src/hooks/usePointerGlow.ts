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
/** A mouse can hover. A phone or a fresh touch session cannot, so glow stays at 0. */
function coarsePointer() {
  return window.matchMedia("(hover: none), (pointer: coarse)").matches;
}

export function usePointerGlow<T extends HTMLElement = HTMLDivElement>(): RefCallback<T> {
  const [el, setEl] = useState<T | null>(null);

  useEffect(() => {
    if (!el) return;
    if (typeof window === "undefined" || !window.matchMedia) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const coarse = coarsePointer();
    let frame = 0;
    let pendingX = 0;
    let pendingY = 0;

    if (coarse) el.style.setProperty("--glow", "0.7");

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
      el.style.setProperty("--glow", coarse ? "0.7" : "0");
    };

    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerdown", onEnter);
    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("pointercancel", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerdown", onEnter);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("pointercancel", onLeave);
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

    const coarse = coarsePointer();
    let frame = 0;
    let driftFrame = 0;
    let pendingX = 0;
    let pendingY = 0;
    let touching = false;

    const paint = () => {
      el.style.setProperty("--gx", `${pendingX}px`);
      el.style.setProperty("--gy", `${pendingY}px`);
      el.style.setProperty("--glow", "1");
    };

    const flush = () => {
      frame = 0;
      paint();
    };

    const onMove = (e: PointerEvent) => {
      touching = e.pointerType !== "mouse";
      pendingX = e.clientX;
      pendingY = e.clientY;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    const onLeaveWindow = (e: PointerEvent) => {
      if (e.relatedTarget != null) return;
      touching = false;
      if (coarse) return;
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--glow", "0");
    };

    const drift = (now: number) => {
      if (!touching) {
        const t = now / 1000;
        pendingX = window.innerWidth * (0.5 + 0.32 * Math.sin(t * 0.45));
        pendingY = window.innerHeight * (0.34 + 0.18 * Math.cos(t * 0.33));
        paint();
      }
      driftFrame = requestAnimationFrame(drift);
    };

    const onUp = () => {
      touching = false;
    };

    if (coarse) driftFrame = requestAnimationFrame(drift);

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    document.documentElement.addEventListener("pointerleave", onLeaveWindow);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (driftFrame) cancelAnimationFrame(driftFrame);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.documentElement.removeEventListener("pointerleave", onLeaveWindow);
    };
  }, [el]);

  return setEl;
}
