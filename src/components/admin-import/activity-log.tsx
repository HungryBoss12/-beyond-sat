import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, RotateCcw, Send, Target } from "lucide-react";
import type { Draft } from "@/lib/import/parse";
import {
  ACTOR_LABEL,
  type ActivityEntry,
} from "@/lib/import/activity-log";
import { CONTROL_CLASS } from "./types";

function truncate(s: string, max = 80): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t || "(empty)";
  return t.slice(0, max - 1) + "…";
}

function actorTone(actor: ActivityEntry["actor"]): string {
  switch (actor) {
    case "gemini-fix":
    case "gemini-locate":
      return "bg-sky-900/60 text-sky-100 ring-sky-400/40";
    case "nemotron-recheck":
      return "bg-amber-900/50 text-amber-100 ring-amber-400/40";
    case "crop":
      return "bg-emerald-900/50 text-emerald-100 ring-emerald-400/40";
    case "admin":
    default:
      return "bg-brand-900 text-brand-100 ring-brand-300/50";
  }
}

export function ActivityLogPanel({
  entries,
  drafts,
  asking,
  onJump,
  onUndo,
  onAsk,
  defaultDraftIndex,
}: {
  entries: ActivityEntry[];
  drafts: Draft[] | null;
  asking?: boolean;
  onJump: (draftIndex: number) => void;
  onUndo: (entryId: string) => void;
  onAsk: (draftIndex: number, instruction: string) => void;
  defaultDraftIndex?: number | null;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const [instruction, setInstruction] = useState("");

  const lastTouched = useMemo(() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i].draftIndex >= 0) return entries[i].draftIndex;
    }
    return defaultDraftIndex ?? 0;
  }, [entries, defaultDraftIndex]);

  useEffect(() => {
    if (drafts?.length) {
      setSelectedIndex((cur) =>
        cur >= 0 && cur < drafts.length ? cur : Math.min(Math.max(0, lastTouched), drafts.length - 1),
      );
    }
  }, [drafts, lastTouched]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length]);

  if (!drafts?.length && entries.length === 0) return null;

  return (
    <div className="rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
      <h2 className="text-sm font-bold text-white">AI activity</h2>
      <p className="mt-1 text-xs text-brand-100">
        Gemini and Nemotron each log what they changed. Jump to a question, undo a change, or ask
        Gemini to edit one.
      </p>

      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-brand-400/30 bg-brand-800 p-3">
        {entries.length === 0 ? (
          <p className="text-xs text-brand-200">No AI actions yet. Fix rows or attach figures to see a log.</p>
        ) : (
          entries.map((e) => (
            <div
              key={e.id}
              className="rounded-lg border border-brand-400/30 bg-brand-900/50 px-3 py-2 text-xs text-brand-100"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${actorTone(e.actor)}`}
                >
                  {ACTOR_LABEL[e.actor]}
                </span>
                {e.model ? (
                  <span className="text-[10px] text-brand-200">{e.model}</span>
                ) : null}
                <span className="font-semibold text-white">Q{e.draftNumber}</span>
                <span className="ml-auto flex gap-1">
                  {e.draftIndex >= 0 && (
                    <button
                      type="button"
                      onClick={() => onJump(e.draftIndex)}
                      className="tap inline-flex items-center gap-1 rounded border border-brand-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-700"
                      title="Jump to question"
                    >
                      <Target className="h-3 w-3" /> Jump
                    </button>
                  )}
                  {e.snapshot && (
                    <button
                      type="button"
                      onClick={() => onUndo(e.id)}
                      className="tap inline-flex items-center gap-1 rounded border border-brand-400/40 px-1.5 py-0.5 text-[10px] font-semibold text-white hover:bg-brand-700"
                      title="Undo this change"
                    >
                      <RotateCcw className="h-3 w-3" /> Undo
                    </button>
                  )}
                </span>
              </div>
              <p className="mt-1 text-brand-100">{e.summary}</p>
              {e.fields.length > 0 && (
                <ul className="mt-1.5 space-y-0.5 border-t border-brand-400/20 pt-1.5 font-mono text-[10px] text-brand-200">
                  {e.fields.slice(0, 8).map((f) => (
                    <li key={f.key}>
                      <span className="text-white">{f.key}</span>: {truncate(f.before, 40)} →{" "}
                      {truncate(f.after, 40)}
                    </li>
                  ))}
                  {e.fields.length > 8 ? (
                    <li>+{e.fields.length - 8} more fields</li>
                  ) : null}
                </ul>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {drafts && drafts.length > 0 && (
        <form
          className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!instruction.trim() || asking) return;
            onAsk(selectedIndex, instruction);
            setInstruction("");
          }}
        >
          <label className="block shrink-0 text-[11px] font-semibold text-brand-100">
            Question
            <select
              value={selectedIndex}
              onChange={(e) => setSelectedIndex(Number(e.target.value))}
              className={CONTROL_CLASS + " mt-1 w-full sm:w-28"}
              disabled={asking}
            >
              {drafts.map((d, i) => (
                <option key={i} value={i}>
                  Q{d.number}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 flex-1 text-[11px] font-semibold text-brand-100">
            Ask Gemini
            <input
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              disabled={asking}
              placeholder="e.g. Fix the LaTeX in choice B"
              className={CONTROL_CLASS + " mt-1"}
            />
          </label>
          <button
            type="submit"
            disabled={asking || !instruction.trim()}
            className="btn-brand inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send
          </button>
        </form>
      )}
    </div>
  );
}
