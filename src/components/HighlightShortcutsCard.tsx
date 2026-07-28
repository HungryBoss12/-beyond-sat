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
      icon: <Highlighter className="h-4 w-4 text-yellow-600" />,
      hint: "Select text in a passage, then press this key.",
    },
    {
      slot: "note",
      label: "Highlight + add note",
      icon: <StickyNote className="h-4 w-4 text-primary" />,
      hint: "Select text, press this key, then type your note.",
    },
  ];

  return (
    <div className="rounded-2xl border border-border bg-white p-6 soft-shadow">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-black text-primary">Highlight shortcuts</h2>
        <button
          onClick={reset}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-2.5 py-1 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Used while solving questions. Changes save to this browser instantly.
      </p>

      <div className="mt-4 space-y-3">
        {rows.map((r) => (
          <div
            key={r.slot}
            className="flex items-center justify-between gap-3 rounded-lg border border-border bg-slate-50/60 p-3"
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="mt-0.5">{r.icon}</div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-slate-800">{r.label}</div>
                <div className="text-xs text-slate-500">{r.hint}</div>
              </div>
            </div>
            <button
              onClick={() => setRecording(recording === r.slot ? null : r.slot)}
              className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-mono font-bold border transition ${
                recording === r.slot
                  ? "border-yellow-400 bg-yellow-100 text-yellow-900 animate-pulse"
                  : "border-border bg-white text-slate-700 hover:bg-slate-100"
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
