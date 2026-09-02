/** Respect OS reduced-motion when choosing scroll animation. */
export function smoothScrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined" || !window.matchMedia) return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

/** Scroll a container to the bottom when the reader is already near the end. */
export function scrollNearBottom(el: HTMLElement, thresholdPx: number): void {
  const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
  if (distance >= thresholdPx) return;
  el.scrollTo({ top: el.scrollHeight, behavior: smoothScrollBehavior() });
}

export function scrollToBottom(el: HTMLElement): void {
  el.scrollTo({ top: el.scrollHeight, behavior: smoothScrollBehavior() });
}

export function scrollWindowToTop(): void {
  window.scrollTo({ top: 0, left: 0, behavior: smoothScrollBehavior() });
}
