import { KeyRound } from "lucide-react";
import { CONTROL_CLASS } from "./types";

/**
 * The answer-key paste box.
 *
 * Neither sample paper carried its answers, so without this every document
 * import lands as rows that fail validation for "No correct answer given". The
 * per-row selector in the preview covers what the key misses.
 */
export function AnswerKeyBox({
  value,
  onChange,
  onApply,
  summary,
}: {
  value: string;
  onChange: (v: string) => void;
  onApply: () => void;
  summary: string | null;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
      <div className="flex items-start gap-2.5">
        <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-brand-200" />
        <div className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">Answer key.</strong> Paste it in any usual shape —{" "}
          <code className="text-white">1. A</code>, <code className="text-white">1) A</code>,{" "}
          <code className="text-white">1-A</code>, or a single run like{" "}
          <code className="text-white">1 A 2 D 3 C</code>. Grid-in values (
          <code className="text-white">16. 3/4</code>) work too. Answers are matched on the question
          number printed in the paper, never guessed by position.
        </div>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        spellCheck={false}
        placeholder={"1. A\n2. D\n3. C"}
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
