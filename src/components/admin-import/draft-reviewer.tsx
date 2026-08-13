import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import type { Draft } from "@/lib/import/parse";
import { DraftEditor } from "./draft-editor";
import { PagePreview } from "./page-preview";
import type { PreviewRow } from "./types";

export function DraftReviewer({
  rows,
  drafts,
  sourcePdf,
  disabled,
  attachingFigure,
  showModule,
  onChangeDraft,
  onSetReviewed,
  onAddAfter,
  onDelete,
  onAttachFigure,
}: {
  rows: PreviewRow[];
  drafts: Draft[];
  sourcePdf: File | null;
  disabled?: boolean;
  attachingFigure?: boolean;
  showModule?: boolean;
  onChangeDraft: (index: number, rec: Record<string, string>) => void;
  onSetReviewed: (index: number, reviewed: boolean) => void;
  onAddAfter?: (index: number) => void;
  onDelete?: (index: number) => void;
  onAttachFigure?: (index: number) => void;
}) {
  const [selected, setSelected] = useState(0);
  const last = Math.max(0, rows.length - 1);
  const index = Math.min(selected, last);
  const preview = rows[index];
  const draftIndex = preview?.draftIndex;
  const draft = draftIndex != null ? drafts[draftIndex] : null;
  const row = preview?.row;

  const reviewedCount = drafts.filter((d) => d.reviewed).length;
  const busy = disabled || attachingFigure;

  useEffect(() => {
    if (selected > last) setSelected(last);
  }, [last, selected]);

  function go(next: number) {
    setSelected(Math.max(0, Math.min(last, next)));
  }

  function looksGood() {
    if (draftIndex == null || busy) return;
    onSetReviewed(draftIndex, true);
    if (index < last) go(index + 1);
  }

  if (!preview || !draft || draftIndex == null || !row) {
    return null;
  }

  const ok = row.question != null;
  const canCrop = Boolean(sourcePdf && draft.sourcePage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-brand-100">
          <strong className="text-white">Edit the set.</strong> Check the page, fix typos, add or
          remove questions. {reviewedCount}/{drafts.length} checked.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => go(index - 1)}
            disabled={index === 0}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="text-xs font-bold tabular-nums text-brand-100">
            {index + 1} / {rows.length}
          </span>
          <button
            type="button"
            onClick={() => go(index + 1)}
            disabled={index === last}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            Next <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={looksGood}
            disabled={busy || row.errors.length > 0}
            title={
              row.errors.length > 0
                ? "Fix the errors on this question before marking it as checked."
                : "Mark this question as checked and go to the next one."
            }
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Check className="h-4 w-4" /> Looks good
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <ol className="flex flex-wrap gap-1.5" aria-label="Jump to question">
          {rows.map((p, i) => {
            const d = p.draftIndex != null ? drafts[p.draftIndex] : null;
            const ready = p.row.question != null;
            return (
              <li key={`${p.row.index}-${i}`}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === index ? "true" : undefined}
                  title={
                    showModule
                      ? `Question ${p.row.index} · Module ${d?.rec.module === "2" ? "2" : "1"}`
                      : `Question ${p.row.index}`
                  }
                  className={
                    "tap h-8 min-w-8 rounded-md px-2 text-[11px] font-bold tabular-nums transition-colors " +
                    (i === index
                      ? "bg-brand-200 text-brand-900"
                      : d?.reviewed
                        ? "bg-brand-400 text-white"
                        : ready
                          ? "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40 hover:bg-brand-500 hover:text-white"
                          : "bg-brand-900 text-white ring-1 ring-brand-300/60 hover:bg-brand-700")
                  }
                >
                  {showModule
                    ? `${d?.rec.module === "2" ? "M2" : "M1"}·${p.row.index}`
                    : p.row.index}
                </button>
              </li>
            );
          })}
        </ol>
        {onAddAfter && (
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onAddAfter(index);
              go(index + 1);
            }}
            className="tap inline-flex items-center gap-1 rounded-lg border border-brand-300/50 bg-brand-800 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add question
          </button>
        )}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <div className="lg:sticky lg:top-3">
          <PagePreview
            file={sourcePdf}
            page={draft.sourcePage}
            questionLabel={`question ${row.index}`}
          />
        </div>
        <div className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-800 p-4">
          <div className="flex items-start gap-2">
            <span
              className={
                "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full " +
                (ok ? "bg-brand-400" : "bg-brand-900 ring-1 ring-brand-300/60")
              }
            >
              {ok ? (
                <Check className="h-3 w-3 text-white" />
              ) : (
                <X className="h-3 w-3 text-brand-200" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white">Question {row.index}</p>
              {draft.reviewed && (
                <p className="text-[11px] font-semibold text-brand-200">Checked against the page</p>
              )}
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              {onAttachFigure && canCrop && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAttachFigure(draftIndex)}
                  className="tap inline-flex items-center gap-1 rounded-md border border-brand-400/50 bg-brand-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  {attachingFigure ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ImageIcon className="h-3 w-3" />
                  )}
                  Attach figure
                </button>
              )}
              {onDelete && drafts.length > 0 && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onDelete(draftIndex)}
                  className="tap inline-flex items-center gap-1 rounded-md border border-brand-300/50 bg-brand-900 px-2 py-1 text-[11px] font-semibold text-white disabled:opacity-40"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              )}
            </div>
          </div>

          {row.errors.length > 0 && (
            <ul className="space-y-1">
              {row.errors.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs font-semibold text-white">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {row.warnings.length > 0 && (
            <ul className="space-y-1">
              {row.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-brand-100">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {w}
                </li>
              ))}
            </ul>
          )}

          <DraftEditor
            draft={draft}
            disabled={busy}
            showModule={showModule}
            onChange={(rec) => onChangeDraft(draftIndex, rec)}
          />
        </div>
      </div>
    </div>
  );
}
