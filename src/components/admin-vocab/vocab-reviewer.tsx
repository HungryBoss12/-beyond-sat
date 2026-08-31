import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import type { DifficultyTier } from "@/lib/vocab/types";
import type { VocabDraft } from "./types";
import { needsVocabAttention } from "./types";

const inputCls =
  "mt-1 w-full rounded-lg border border-brand-400/40 bg-brand-900 px-3 py-2 text-sm text-white placeholder:text-brand-200/60";

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div>
      <label className="text-xs font-semibold text-brand-200">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={2}
          className={inputCls}
        />
      ) : (
        <input value={value} onChange={(e) => onChange(e.target.value)} className={inputCls} />
      )}
    </div>
  );
}

export function VocabReviewer({
  drafts,
  disabled,
  fixingIndex,
  showQuizFields,
  onChange,
  onSetReviewed,
  onFixOne,
  onRemove,
}: {
  drafts: VocabDraft[];
  disabled?: boolean;
  fixingIndex?: number | null;
  showQuizFields: boolean;
  onChange: (index: number, patch: Partial<VocabDraft>) => void;
  onSetReviewed: (index: number, reviewed: boolean) => void;
  onFixOne: (index: number) => void;
  onRemove: (index: number) => void;
}) {
  const [selected, setSelected] = useState(0);
  const last = Math.max(0, drafts.length - 1);
  const index = Math.min(selected, last);
  const draft = drafts[index];
  const busy = disabled || fixingIndex != null;
  const reviewedCount = drafts.filter((d) => d.reviewed).length;

  useEffect(() => {
    if (selected > last) setSelected(last);
  }, [last, selected]);

  function go(next: number) {
    setSelected(Math.max(0, Math.min(last, next)));
  }

  function looksGood() {
    if (busy || !draft) return;
    onSetReviewed(index, true);
    if (index < last) go(index + 1);
  }

  if (!draft) return null;

  const attention = needsVocabAttention(draft);
  const fixing = fixingIndex === index;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">Review each word.</strong> Check fields, use Fix with AI to
          enrich SAT content, then mark reviewed. {reviewedCount}/{drafts.length} checked.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0 || busy}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs font-bold tabular-nums text-brand-100">
            {index + 1} / {drafts.length}
          </span>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === last || busy}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={looksGood}
            disabled={busy || !draft.word.trim() || !draft.definition.trim()}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Looks good
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ol className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto" aria-label="Jump to word">
          {drafts.map((d, i) => (
            <li key={`${d.word}-${i}`}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === index ? "true" : undefined}
                title={d.word}
                className={
                  "tap h-8 min-w-8 rounded-md px-2 text-[11px] font-bold tabular-nums transition-colors " +
                  (i === index
                    ? "bg-brand-200 text-brand-900"
                    : d.reviewed
                      ? "bg-brand-400 text-white"
                      : needsVocabAttention(d)
                        ? "bg-brand-900 text-white ring-1 ring-brand-300/60 hover:bg-brand-700"
                        : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40 hover:bg-brand-500 hover:text-white")
                }
              >
                {i + 1}
              </button>
            </li>
          ))}
        </ol>
      </div>

      <div className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
        <div className="flex items-start gap-3">
          <label className="mt-1 inline-flex shrink-0 items-center gap-2 text-xs font-semibold text-brand-100">
            <input
              type="checkbox"
              checked={draft.reviewed}
              disabled={busy}
              onChange={(e) => onSetReviewed(index, e.target.checked)}
              className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
            />
            Reviewed
          </label>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <input
                value={draft.word}
                disabled={busy}
                onChange={(e) => onChange(index, { word: e.target.value })}
                className="w-full bg-transparent text-xl font-black text-white border-b border-brand-400/30 focus:border-brand-200 outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => onRemove(index)}
                className="text-brand-200 hover:text-red-300"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            {draft.reviewed ? (
              <p className="mt-1 text-[11px] font-semibold text-brand-200">Marked as reviewed</p>
            ) : attention ? (
              <p className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-100">
                <AlertTriangle className="h-3 w-3" /> May need AI enrichment
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 flex-col gap-1.5">
            <button
              type="button"
              disabled={busy || !draft.word.trim()}
              onClick={() => onFixOne(index)}
              className="tap inline-flex items-center gap-1 rounded-md border border-brand-400/50 bg-brand-900 px-2.5 py-1.5 text-[11px] font-semibold text-white disabled:opacity-40"
            >
              {fixing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Sparkles className="h-3 w-3" />
              )}
              Fix with AI
            </button>
          </div>
        </div>

        {!draft.reviewed && (
          <div className="rounded-lg bg-brand-900/60 px-3 py-2 text-xs text-brand-100">
            Unchecked words can still be fixed with AI using the button above.
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Part of speech"
            value={draft.partOfSpeech}
            onChange={(v) => onChange(index, { partOfSpeech: v })}
          />
          <Field
            label="Difficulty"
            value={draft.difficultyTier ?? "Medium"}
            onChange={(v) => onChange(index, { difficultyTier: v as DifficultyTier })}
          />
        </div>
        <Field
          label="Definition"
          value={draft.definition}
          onChange={(v) => onChange(index, { definition: v })}
          multiline
        />
        {"exampleSentence" in draft || draft.exampleSentence ? (
          <Field
            label="Example sentence"
            value={draft.exampleSentence ?? ""}
            onChange={(v) => onChange(index, { exampleSentence: v })}
            multiline
          />
        ) : null}
        {"antonym" in draft || draft.antonym ? (
          <Field
            label="Antonym"
            value={draft.antonym ?? ""}
            onChange={(v) => onChange(index, { antonym: v })}
          />
        ) : null}
        {"setLabel" in draft || draft.setLabel ? (
          <Field
            label="Set"
            value={draft.setLabel ?? ""}
            onChange={(v) => onChange(index, { setLabel: v })}
          />
        ) : null}
        <Field
          label="dSAT passage"
          value={draft.dSatPassage}
          onChange={(v) => onChange(index, { dSatPassage: v })}
          multiline
        />
        <Field
          label="Roots / etymology"
          value={draft.rootsEtymology ?? ""}
          onChange={(v) => onChange(index, { rootsEtymology: v })}
        />
        <Field
          label="Synonyms (comma-separated)"
          value={draft.synonyms.join(", ")}
          onChange={(v) =>
            onChange(index, {
              synonyms: v
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
        <Field
          label="SAT traps"
          value={draft.satTraps ?? ""}
          onChange={(v) => onChange(index, { satTraps: v })}
          multiline
        />

        {showQuizFields ? (
          <div className="rounded-lg border border-brand-400/30 bg-brand-900/50 p-3 space-y-2">
            <div className="text-xs font-bold uppercase text-brand-200">Quiz question</div>
            <Field
              label="Passage"
              value={draft.quizQuestion.passageText}
              onChange={(v) =>
                onChange(index, {
                  quizQuestion: { ...draft.quizQuestion, passageText: v },
                })
              }
              multiline
            />
            <Field
              label="Options (comma-separated, 4)"
              value={draft.quizQuestion.options.join(", ")}
              onChange={(v) =>
                onChange(index, {
                  quizQuestion: {
                    ...draft.quizQuestion,
                    options: v
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  },
                })
              }
            />
            <Field
              label="Correct answer"
              value={draft.quizQuestion.correctAnswer}
              onChange={(v) =>
                onChange(index, {
                  quizQuestion: { ...draft.quizQuestion, correctAnswer: v },
                })
              }
            />
            <Field
              label="Explanation"
              value={draft.quizQuestion.explanation}
              onChange={(v) =>
                onChange(index, {
                  quizQuestion: { ...draft.quizQuestion, explanation: v },
                })
              }
              multiline
            />
          </div>
        ) : null}

        {attention && !draft.reviewed && (
          <div className="flex items-start gap-1.5 text-xs text-brand-100">
            <X className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
            Placeholder passage or missing synonyms — use Fix with AI or edit manually.
          </div>
        )}
      </div>
    </div>
  );
}
