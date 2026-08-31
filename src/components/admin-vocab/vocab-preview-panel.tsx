import { Loader2, Save, Sparkles, Square, Wrench } from "lucide-react";
import { Stat } from "@/components/admin-import/preview-panel";
import { VocabReviewer } from "./vocab-reviewer";
import type { VocabDraft } from "./types";
import { needsVocabAttention } from "./types";

export function VocabPreviewPanel({
  drafts,
  saving,
  fixing,
  fixingIndex,
  showQuizFields,
  saveLabel,
  onSave,
  onChange,
  onSetReviewed,
  onFixOne,
  onFixMany,
  onStopFix,
  onRemove,
}: {
  drafts: VocabDraft[];
  saving: boolean;
  fixing: boolean;
  fixingIndex: number | null;
  showQuizFields: boolean;
  saveLabel: string;
  onSave: () => void;
  onChange: (index: number, patch: Partial<VocabDraft>) => void;
  onSetReviewed: (index: number, reviewed: boolean) => void;
  onFixOne: (index: number) => void;
  onFixMany: () => void;
  onStopFix: () => void;
  onRemove: (index: number) => void;
}) {
  const reviewed = drafts.filter((d) => d.reviewed).length;
  const needsAttention = drafts.filter((d) => needsVocabAttention(d)).length;
  const fixable = drafts.filter((d) => needsVocabAttention(d) && !d.reviewed).length;

  return (
    <div className="rise-in space-y-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Parsed" value={drafts.length} />
        <Stat label="Reviewed" value={reviewed} tone="good" />
        {needsAttention > 0 && <Stat label="Needs attention" value={needsAttention} tone="bad" />}
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        {fixable > 0 &&
          (fixing ? (
            <button
              type="button"
              onClick={onStopFix}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/60 bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
            >
              <Square className="h-3.5 w-3.5" /> Stop fix
            </button>
          ) : (
            <button
              type="button"
              onClick={onFixMany}
              disabled={saving}
              className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-400 disabled:opacity-40"
            >
              <Wrench className="h-4 w-4" />
              Fix {fixable} with AI
            </button>
          ))}
        <button
          type="button"
          onClick={onSave}
          disabled={saving || fixing || drafts.length === 0}
          className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving…" : saveLabel}
        </button>
      </div>

      {fixing && (
        <div
          className="flex items-center gap-2 rounded-xl border border-brand-400/40 bg-brand-800 px-4 py-3 text-xs font-semibold text-brand-100"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {fixingIndex != null
            ? `Fixing “${drafts[fixingIndex]?.word ?? "word"}” with AI…`
            : "Running bulk Fix with AI…"}
        </div>
      )}

      {needsAttention > 0 && !fixing && (
        <div className="rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
          {needsAttention} word{needsAttention === 1 ? "" : "s"} still use placeholder content or
          lack synonyms. Use Fix with AI on each card, or run bulk fix above.
        </div>
      )}

      <VocabReviewer
        drafts={drafts}
        disabled={saving}
        fixingIndex={fixing ? fixingIndex : null}
        showQuizFields={showQuizFields}
        onChange={onChange}
        onSetReviewed={onSetReviewed}
        onFixOne={onFixOne}
        onRemove={onRemove}
      />
    </div>
  );
}

export function ExampleDeckButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-lg border border-brand-300/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      Load example deck
    </button>
  );
}
