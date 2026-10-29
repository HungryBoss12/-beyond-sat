import { smoothScrollBehavior } from "./smooth-scroll";

/** How quickly the page catches the wheel. Lower glides longer. */
const EASE = 0.12;

/** Firefox reports wheel ticks as lines. One line is about this many pixels. */
const LINE_PX = 40;

export function wheelDeltaPixels(delta: number, deltaMode: number, pageHeight: number): number {
  if (deltaMode === 1) return delta * LINE_PX;
  if (deltaMode === 2) return delta * pageHeight;
  return delta;
}

function nestedCanScroll(start: EventTarget | null, deltaY: number): boolean {
  let el = start instanceof Element ? start : null;
  while (el && el !== document.body && el !== document.documentElement) {
    const style = getComputedStyle(el);
    const oy = style.overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && el.scrollHeight > el.clientHeight + 1) {
      const atTop = el.scrollTop <= 0;
      const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1;
      if ((deltaY < 0 && !atTop) || (deltaY > 0 && !atBottom)) return true;
    }
    el = el.parentElement;
  }
  return false;
}

function pageScroller(): HTMLElement {
  const scrolling = document.scrollingElement;
  return scrolling instanceof HTMLElement ? scrolling : document.documentElement;
}

/**
 * The mouse wheel ignores CSS `scroll-behavior`. This eases the page itself
 * so a wheel notch glides instead of jumping. Nested panels, pinch-zoom, and
 * sideways pans stay on the browser's own scroll.
 */
export function installSmoothWheel(): () => void {
  if (smoothScrollBehavior() === "auto") return () => undefined;

  const scroller = pageScroller();
  scroller.style.scrollBehavior = "auto";
  let target = scroller.scrollTop;
  let frame = 0;

  const maxScroll = () => Math.max(0, scroller.scrollHeight - window.innerHeight);

  const step = () => {
    const current = scroller.scrollTop;
    const next = current + (target - current) * EASE;
    if (Math.abs(target - next) < 0.6) {
      scroller.scrollTop = target;
      frame = 0;
      return;
    }
    scroller.scrollTop = next;
    frame = window.requestAnimationFrame(step);
  };

  const onWheel = (event: WheelEvent) => {
    if (event.ctrlKey || event.metaKey) return;
    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (nestedCanScroll(event.target, event.deltaY)) return;
    if (!event.cancelable) return;
    event.preventDefault();
    const dy = wheelDeltaPixels(event.deltaY, event.deltaMode, window.innerHeight);
    if (!frame) target = scroller.scrollTop;
    target = Math.min(maxScroll(), Math.max(0, target + dy));
    if (!frame) frame = window.requestAnimationFrame(step);
  };

  const onScroll = () => {
    if (frame) return;
    target = scroller.scrollTop;
  };

  window.addEventListener("wheel", onWheel, { passive: false, capture: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  return () => {
    window.removeEventListener("wheel", onWheel, { capture: true });
    window.removeEventListener("scroll", onScroll);
    if (frame) window.cancelAnimationFrame(frame);
    scroller.style.scrollBehavior = "";
  };
}
