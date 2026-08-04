import { useEffect, useRef } from "react";

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
 */
export function usePointerGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // matchMedia is unavailable during SSR; this effect is client-only so the
    // guard is just for safety in test environments.
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

    const onMove = (e: PointerEvent) => {
      // getBoundingClientRect is read here rather than cached because cards move
      // on scroll and on hover (the `lift` utility translates them).
      const rect = el.getBoundingClientRect();
      pendingX = e.clientX - rect.left;
      pendingY = e.clientY - rect.top;
      if (!frame) frame = requestAnimationFrame(flush);
    };

    /* Opacity is driven by a separate variable so the glow fades out on leave
       instead of snapping — and so it stays hidden until the pointer has
       actually been somewhere, rather than flashing at the top-left corner. */
    const onEnter = () => el.style.setProperty("--glow", "1");
    const onLeave = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      el.style.setProperty("--glow", "0");
    };

    el.addEventListener("pointermove", onMove, { passive: true });
    el.addEventListener("pointerenter", onEnter);
    el.addEventListener("pointerleave", onLeave);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerenter", onEnter);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}

/**
 * Viewport-level variant: tracks the pointer across the whole window and writes
 * `--gx` / `--gy` onto the returned element, which is expected to be a fixed
 * overlay. Used for the landing page's ambient spotlight.
 *
 * Kept separate from `usePointerGlow` because the maths differs — this one wants
 * viewport coordinates, not element-relative ones, so there's no rect to read.
 */
export function useAmbientGlow<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
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

    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return ref;
}
