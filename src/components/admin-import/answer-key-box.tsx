import { KeyRound } from "lucide-react";
import { CONTROL_CLASS } from "./types";

/**
 * The answer-key paste box.
 *
 * A whole paper is two modules that both start at question 1, so the useful
 * paste is a section block, not a flat numbered list. Numbered lines still work
 * for a single module.
 */
export function AnswerKeyBox({
  value,
  onChange,
  onApply,
  summary,
  bothModules,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  summary: string | null;
  bothModules?: boolean;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
        <div className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">Answer key.</strong>{" "}
          {bothModules ? (
            <>
              Paste each module under its heading — <code className="text-white">Section 1:</code>{" "}
              then the answers, then <code className="text-white">Section 2:</code>. A run of
              letters (<code className="text-white">A D C B</code> or{" "}
              <code className="text-white">ADCB</code>) fills that module in order. Numbered lines (
              <code className="text-white">1. A</code>) work too. Grid-ins like{" "}
              <code className="text-white">3/4</code> are fine in the run.
            </>
          ) : (
            <>
              Paste numbered lines (<code className="text-white">1. A</code>,{" "}
              <code className="text-white">1) A</code>) or a letter run. For a whole paper use{" "}
              <code className="text-white">Section 1:</code> /{" "}
              <code className="text-white">Section 2:</code> blocks.
            </>
          )}
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={bothModules ? 7 : 4}
        spellCheck={false}
        placeholder={
          bothModules
            ? "Section 1: A D C B A C D B …\nSection 2: B A D C A B …"
            : "1. A\n2. D\n3. C"
        }
        className={CONTROL_CLASS + " resize-y font-mono text-xs leading-relaxed"}
      />
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={onApply}
          disabled={!value.trim()}
          className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-400/50 bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-400 disabled:opacity-40"
        >
          <KeyRound className="h-4 w-4" /> Apply key
        </button>
        {summary && <span className="text-xs text-brand-100">{summary}</span>}
      </div>
    </div>
  );
}
