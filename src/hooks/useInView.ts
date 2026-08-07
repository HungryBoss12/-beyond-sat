import { useEffect, useRef, useState } from "react";

/**
 * Reports whether the returned element has entered the viewport, once.
 *
 * The existing `rise-in` / `stagger` utilities in styles.css fire on mount,
 * which is right for above-the-fold content and wrong for anything further down
 * the landing page — those sections finish animating long before the visitor
 * scrolls to them. This gates the class so the animation plays on arrival.
 *
 * It latches rather than toggling: re-animating a section every time it
 * re-enters the viewport is a distraction on the way back up the page.
 *
 * Defaults to `true` when IntersectionObserver is unavailable (older browsers,
 * SSR, jsdom) so content is never left invisible by a missing API — the
 * animation is the enhancement, the content is not.
 */
export function useInView<T extends HTMLElement = HTMLDivElement>(rootMargin = "-12% 0px") {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return { ref, inView };
}

/**
 * Tracks an element's travel through the viewport as a 0→1 value written to the
 * CSS custom property `--p` on that element.
 *
 * 0 is "the element's top has just reached the bottom of the viewport", 1 is "its
 * bottom has just left the top". Anything downstream reads `--p` in a `calc()`,
 * so parallax is expressed in CSS rather than in JS.
 *
 * The value deliberately never touches React state. Setting state from a scroll
 * handler re-renders the entire landing page on every frame; writing a custom
 * property mutates one element and the compositor takes it from there. The same
 * approach as `usePointerGlow`.
 *
 * Nothing is written under `prefers-reduced-motion`: every consumer falls back to
 * `--p: 0`, its resting position, so the layout is simply static.
 */
export function useScrollProgress<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof window === "undefined") return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

    let frame = 0;

    const measure = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const span = window.innerHeight + rect.height;
      if (span <= 0) return;
      const travelled = window.innerHeight - rect.top;
      const p = Math.min(1, Math.max(0, travelled / span));
      el.style.setProperty("--p", p.toFixed(4));
    };

    /* Coalesce to one write per frame. A scroll handler can fire several times
       between paints, and the extra writes are invisible work. */
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(measure);
    };

    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return ref;
}
