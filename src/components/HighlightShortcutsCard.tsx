import { useEffect, useState, type ReactNode } from "react";
import { Highlighter, StickyNote, RotateCcw } from "lucide-react";
import {
  DEFAULT_HIGHLIGHT_BINDINGS,
  formatBinding,
  loadHighlightBindings,
  saveHighlightBindings,
  type HighlightBindings,
} from "@/lib/highlightBindings";

type Slot = keyof HighlightBindings;

export function HighlightShortcutsCard() {
  const [bindings, setBindings] = useState<HighlightBindings>(DEFAULT_HIGHLIGHT_BINDINGS);
  const [recording, setRecording] = useState<Slot | null>(null);

  useEffect(() => {
    setBindings(loadHighlightBindings());
  }, []);

  useEffect(() => {
    if (!recording) return;
    function onKey(e: KeyboardEvent) {
      if (["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
      e.preventDefault();
      if (e.key === "Escape") {
        setRecording(null);
        return;
      }
      const next: HighlightBindings = {
        ...bindings,
        [recording!]: {
          key: e.key,
          shift: e.shiftKey,
          alt: e.altKey,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
        },
      };
      setBindings(next);
      saveHighlightBindings(next);
      setRecording(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [recording, bindings]);

  function reset() {
    setBindings(DEFAULT_HIGHLIGHT_BINDINGS);
    saveHighlightBindings(DEFAULT_HIGHLIGHT_BINDINGS);
    setRecording(null);
  }

  const rows: { slot: Slot; label: string; icon: ReactNode; hint: string }[] = [
    {
      slot: "highlight",
      label: "Highlight selection",
      icon: <Highlighter className="h-4 w-4 text-brand-100" />,
      hint: "Select text in a passage, then press this key.",
    },
    {
      slot: "note",
      label: "Highlight + add note",
      icon: <StickyNote className="h-4 w-4 text-brand-100" />,
      hint: "Select text, press this key, then type your note.",
    },
  ];

  return (
    <div className="rise-in rounded-2xl border border-brand-400/40 bg-brand-600 p-6 shadow-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-white">Highlight shortcuts</h2>
        <button
          onClick={reset}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 px-2.5 py-1 text-xs font-bold text-brand-100 hover:bg-brand-800 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
      <p className="mt-1 text-xs text-brand-100">
        Used while solving questions. Changes save to this browser instantly.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.slot}
            className="flex items-center justify-between gap-3 rounded-lg border border-brand-400/40 bg-brand-800 p-3"
          >
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5">{r.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-white">{r.label}</div>
                <div className="text-xs text-brand-100">{r.hint}</div>
              </div>
            </div>
            {/* Recording used to flash yellow; it's the lit brand step pulsing instead. */}
            <button
              onClick={() => setRecording(recording === r.slot ? null : r.slot)}
              className={`shrink-0 rounded-md border px-3 py-1.5 font-mono text-xs font-bold transition ${
                recording === r.slot
                  ? "animate-pulse border-brand-200 bg-brand-400 text-white"
                  : "border-brand-400/50 bg-brand-600 text-white hover:bg-brand-400"
              }`}
              title="Click, then press any key combo. Esc to cancel."
            >
              {recording === r.slot ? "Press key…" : formatBinding(bindings[r.slot])}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
