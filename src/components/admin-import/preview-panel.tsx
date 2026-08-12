import { useState } from "react";
import {
  AlertTriangle,
  Check,
  Loader2,
  Square,
  Upload,
  Wrench,
  X,
} from "lucide-react";
import { MathText } from "@/components/MathText";
import type { Draft } from "@/lib/import/parse";
import type { RowResult } from "@/lib/question-import";
import { SECTION_LABEL, difficultyColor } from "@/lib/sat";
import { StageBar } from "./stage-bar";
import type { FixProgress, PreviewRow } from "./types";

export function PreviewPanel({
  rows,
  ignoredColumns,
  stats,
  skipDuplicates,
  setSkipDuplicates,
  importing,
  progress,
  onImport,
  onAnswerChange,
  drafts,
  setLabel,
  fixing,
  fixProgress,
  onFixBroken,
  onStopFix,
}: {
  rows: PreviewRow[];
  ignoredColumns: string[];
  stats: {
    total: number;
    valid: number;
    invalid: number;
    warnings: number;
    duplicates: number;
    importable: number;
  };
  skipDuplicates: boolean;
  setSkipDuplicates: (v: boolean) => void;
  importing: boolean;
  progress: { done: number; total: number };
  onImport: () => void;
  onAnswerChange?: (index: number, value: string) => void;
  drafts: Draft[] | null;
  setLabel: string | null;
  fixing?: boolean;
  fixProgress?: FixProgress | null;
  onFixBroken?: () => void;
  onStopFix?: () => void;
}) {
  const [showOnlyProblems, setShowOnlyProblems] = useState(false);
  const visible = showOnlyProblems
    ? rows.filter((p) => !p.row.question || p.row.warnings.length > 0)
    : rows;

  const brokenCount = rows.filter((p) => {
    if (p.draftIndex == null) return false;
    if (!p.row.question || p.row.errors.length > 0) return true;
    return p.row.warnings.some(
      (w) =>
        !w.includes("Duplicate") &&
        !w.includes("already exists") &&
        !w.includes("Repaired by Gemini"),
    );
  }).length;

  const fixTotal = fixProgress?.total ?? Math.max(brokenCount, 1);
  const stage1Pct = fixProgress
    ? Math.min(100, Math.round((fixProgress.stage1Done / fixTotal) * 100))
    : 0;
  const stage2Pct = fixProgress
    ? Math.min(100, Math.round((fixProgress.stage2Done / fixTotal) * 100))
    : 0;
  const overallFixPct = fixProgress
    ? Math.min(
        100,
        Math.round(((fixProgress.stage1Done + fixProgress.stage2Done) / (fixTotal * 2)) * 100),
      )
    : 0;

  return (
    <div className="rise-in space-y-4 rounded-2xl border border-brand-400/40 bg-brand-600 p-5 shadow-panel md:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Stat label="Parsed" value={stats.total} />
        <Stat label="Ready" value={stats.valid} tone="good" />
        {stats.invalid > 0 && <Stat label="Errors" value={stats.invalid} tone="bad" />}
        {stats.warnings > 0 && <Stat label="Warnings" value={stats.warnings} />}
        {stats.duplicates > 0 && <Stat label="Duplicates" value={stats.duplicates} />}
      </div>

      {ignoredColumns.length > 0 && (
        <div className="rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
          Ignored unrecognised {ignoredColumns.length === 1 ? "column" : "columns"}:{" "}
          <span className="font-semibold text-white">{ignoredColumns.join(", ")}</span>. If one of
          those was meant to be a real field, check its spelling against the format above.
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          {stats.duplicates > 0 && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={skipDuplicates}
                onChange={(e) => setSkipDuplicates(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Skip the {stats.duplicates} duplicate{stats.duplicates === 1 ? "" : "s"}
            </label>
          )}
          {(stats.invalid > 0 || stats.warnings > 0) && (
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-brand-100">
              <input
                type="checkbox"
                checked={showOnlyProblems}
                onChange={(e) => setShowOnlyProblems(e.target.checked)}
                className="h-4 w-4 accent-brand-200 [color-scheme:dark]"
              />
              Show only rows needing attention
            </label>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onFixBroken &&
            brokenCount > 0 &&
            (fixing ? (
              <button
                onClick={onStopFix}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/60 bg-brand-900 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-700"
              >
                <Square className="h-3.5 w-3.5" /> Stop fix
              </button>
            ) : (
              <button
                onClick={onFixBroken}
                disabled={importing}
                className="tap inline-flex items-center gap-1.5 rounded-lg border border-brand-300/50 bg-brand-800 px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-brand-400 disabled:opacity-40"
              >
                <Wrench className="h-4 w-4" />
                Fix {brokenCount} broken with AI
              </button>
            ))}
          <button
            onClick={onImport}
            disabled={importing || fixing || stats.importable === 0}
            className="btn-brand inline-flex items-center gap-1.5 rounded-lg bg-brand-400 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            {importing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {importing
              ? `Importing ${progress.done}/${progress.total}…`
              : `Import ${stats.importable} question${stats.importable === 1 ? "" : "s"}`}
          </button>
        </div>
      </div>

      {fixing && (
        <div
          className="space-y-3 rounded-xl border border-brand-400/40 bg-brand-800 p-4"
          role="status"
          aria-live="polite"
          aria-label="Fix progress"
        >
          <div className="text-xs leading-relaxed text-brand-100">
            <strong className="text-white">Two-factor repair.</strong> Gemini Pro fixes each broken
            row, then Gemini Flash rechecks it. Review the preview after the pass.
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-[11px] font-semibold text-brand-100">
              <span>Overall</span>
              <span>{overallFixPct}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-brand-900">
              <div
                className="h-full rounded-full bg-brand-200 transition-[width] duration-300"
                style={{ width: `${overallFixPct}%` }}
              />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <StageBar
              label="1 · Fix"
              detail="Gemini 2.5 Pro"
              pct={stage1Pct}
              active={fixProgress?.stage === 1}
              done={fixProgress?.stage1Done ?? 0}
              total={fixTotal}
            />
            <StageBar
              label="2 · Recheck"
              detail="Gemini 2.5 Flash"
              pct={stage2Pct}
              active={fixProgress?.stage === 2}
              done={fixProgress?.stage2Done ?? 0}
              total={fixTotal}
            />
          </div>
          <div className="flex items-center gap-2 text-[11px] font-semibold text-brand-100">
            <Loader2 className="h-3 w-3 animate-spin" />
            {fixProgress
              ? `Q${fixProgress.draftNumber} · ${fixProgress.index}/${fixProgress.total} · Stage ${fixProgress.stage} (${fixProgress.stageLabel}) · ${fixProgress.fixed} fixed`
              : "Starting repair…"}
          </div>
        </div>
      )}

      {setLabel && (
        <div className="rounded-lg bg-brand-800 px-3 py-2 text-xs text-brand-100">
          These will also be grouped into the test set{" "}
          <span className="font-semibold text-white">{setLabel}</span>, in the order shown, so
          students see them as one dated paper.
        </div>
      )}

      {stats.invalid > 0 && !fixing && (
        <div className="rounded-lg bg-brand-900 px-3 py-2 text-xs font-semibold text-white ring-1 ring-brand-300/60">
          {stats.invalid} row{stats.invalid === 1 ? "" : "s"} {stats.invalid === 1 ? "has" : "have"}{" "}
          an error and won't be imported.
          {onFixBroken
            ? " Use Fix broken with AI, paste an answer key, or set the answer on the row."
            : onAnswerChange
              ? " Most will be a missing answer — paste a key above, or set the answer on the row itself."
              : " Fix them in your source and paste again — the rows that are ready can be imported now either way."}
        </div>
      )}

      <ul className="divide-y divide-brand-400/30 overflow-hidden rounded-xl border border-brand-400/40">
        {visible.map((p) => (
          <RowPreview
            key={p.row.index}
            row={p.row}
            draft={p.draftIndex != null ? (drafts?.[p.draftIndex] ?? null) : null}
            onAnswerChange={
              onAnswerChange && p.draftIndex != null
                ? (v) => onAnswerChange(p.draftIndex as number, v)
                : undefined
            }
          />
        ))}
      </ul>
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider " +
        (tone === "good"
          ? "bg-brand-400 text-white"
          : tone === "bad"
            ? "bg-brand-900 text-white ring-1 ring-brand-300/60"
            : "bg-brand-800 text-brand-100")
      }
    >
      {label}
      <span className="tabular-nums text-white">{value}</span>
    </span>
  );
}

export function RowPreview({
  row,
  draft,
  onAnswerChange,
}: {
  row: RowResult;
  draft: Draft | null;
  onAnswerChange?: (value: string) => void;
}) {
  const q = row.question;
  const ok = q != null;

  /* Read off the draft rather than the validated question, because a row with an
     error has no `question` at all — and a missing answer is exactly the error
     this selector exists to fix. */
  const choiceIds = draft
    ? ["A", "B", "C", "D", "E", "F", "G", "H"].filter((id) =>
        (draft.rec[`choice_${id}`] ?? "").trim(),
      )
    : [];
  const answer = draft?.rec.correct ?? "";

  return (
    <li className={"px-4 py-3 " + (ok ? "bg-brand-600" : "bg-brand-900/40")}>
      <div className="flex items-start gap-3">
        <span
          className={
            "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full " +
            (ok ? "bg-brand-400" : "bg-brand-900 ring-1 ring-brand-300/60")
          }
        >
          {ok ? <Check className="h-3 w-3 text-white" /> : <X className="h-3 w-3 text-brand-200" />}
        </span>
        <span className="mt-0.5 w-8 shrink-0 text-xs font-bold tabular-nums text-brand-200">
          {row.index}
        </span>
        <div className="min-w-0 flex-1">
          {q ? (
            <>
              <MathText className="line-clamp-2 text-sm font-semibold text-white">
                {q.question_text}
              </MathText>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded bg-brand-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                  {SECTION_LABEL[q.section]}
                </span>
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  {q.skill}
                </span>
                <span
                  className={
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider " +
                    difficultyColor(q.difficulty)
                  }
                >
                  {q.difficulty}
                </span>
                <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                  {q.kind === "grid_in" ? "Grid-in" : "Multiple choice"}
                </span>
                {!onAnswerChange && (
                  <span className="rounded bg-brand-800 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-100">
                    Answer{" "}
                    <span className="text-white">
                      {q.kind === "grid_in"
                        ? (q.correct_grid_answers ?? []).join(" / ")
                        : q.correct_choice_id}
                    </span>
                  </span>
                )}
              </div>
            </>
          ) : (
            <div className="text-sm font-semibold text-white">
              {draft?.rec.question_text ? (
                <MathText className="line-clamp-2">{draft.rec.question_text}</MathText>
              ) : (
                "Not imported"
              )}
            </div>
          )}

          {onAnswerChange && draft && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-200">
                Answer
              </span>
              {choiceIds.length > 0 ? (
                choiceIds.map((id) => (
                  <button
                    key={id}
                    onClick={() => onAnswerChange(answer.trim().toUpperCase() === id ? "" : id)}
                    title={draft.rec[`choice_${id}`]}
                    className={
                      "tap h-6 w-6 rounded-md text-[11px] font-bold transition-colors " +
                      (answer.trim().toUpperCase() === id
                        ? "bg-brand-400 text-white"
                        : "bg-brand-800 text-brand-100 ring-1 ring-brand-400/40 hover:bg-brand-500 hover:text-white")
                    }
                  >
                    {id}
                  </button>
                ))
              ) : (
                <input
                  value={answer}
                  onChange={(e) => onAnswerChange(e.target.value)}
                  placeholder="3/4, 0.75"
                  className="w-40 rounded-md border border-brand-400/50 bg-brand-800 px-2 py-1 text-xs text-white placeholder:text-brand-200 focus:border-brand-200 focus:outline-none"
                />
              )}
            </div>
          )}

          {row.errors.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.errors.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs font-semibold text-white">
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {e}
                </li>
              ))}
            </ul>
          )}
          {row.warnings.length > 0 && (
            <ul className="mt-2 space-y-1">
              {row.warnings.map((w, i) => (
                <li key={i} className="flex items-start gap-1.5 text-xs text-brand-100">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-brand-200" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}
