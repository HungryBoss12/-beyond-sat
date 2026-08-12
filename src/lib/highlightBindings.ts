// Shared, editable keyboard shortcuts for the passage highlighter.
// Persisted in localStorage so the Profile editor and the Question card stay in sync.

export type Binding = {
  key: string;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
};

export type HighlightBindings = {
  highlight: Binding;
  note: Binding;
};

export const DEFAULT_HIGHLIGHT_BINDINGS: HighlightBindings = {
  highlight: { key: "H", shift: false, alt: false, ctrl: false, meta: false },
  note: { key: "H", shift: true, alt: false, ctrl: false, meta: false },
};

const STORAGE_KEY = "qc.bindings";
const EVENT = "qc.bindings.changed";

export function loadHighlightBindings(): HighlightBindings {
  if (typeof window === "undefined") return DEFAULT_HIGHLIGHT_BINDINGS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_HIGHLIGHT_BINDINGS;
    return { ...DEFAULT_HIGHLIGHT_BINDINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_HIGHLIGHT_BINDINGS;
  }
}

export function saveHighlightBindings(next: HighlightBindings) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    void 0;
  }
}

export function subscribeHighlightBindings(cb: (b: HighlightBindings) => void) {
  const handler = () => cb(loadHighlightBindings());
  window.addEventListener(EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function formatBinding(b: Binding): string {
  const parts: string[] = [];
  if (b.ctrl) parts.push("Ctrl");
  if (b.meta) parts.push("⌘");
  if (b.alt) parts.push("Alt");
  if (b.shift) parts.push("⇧");
  parts.push(b.key.length === 1 ? b.key.toUpperCase() : b.key);
  return parts.join("+");
}

export function matchesBinding(e: KeyboardEvent, b: Binding): boolean {
  if (
    e.shiftKey !== b.shift ||
    e.altKey !== b.alt ||
    e.ctrlKey !== b.ctrl ||
    e.metaKey !== b.meta
  ) {
    return false;
  }
  return e.key.toLowerCase() === b.key.toLowerCase();
}
