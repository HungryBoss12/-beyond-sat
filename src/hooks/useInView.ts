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
