import type { RowResult } from "@/lib/question-import";

export type Mode = "upload" | "sheet" | "json";

export const CONTROL_CLASS =
  "w-full rounded-lg border border-brand-400/50 bg-brand-800 px-3 py-2 text-sm text-white [color-scheme:dark] placeholder:text-brand-200 focus:border-brand-200 focus:outline-none";

/** Rows per insert request. Keeps the payload well under any body limit. */
export const CHUNK = 100;

/**
 * A row in the preview, plus the draft it came from.
 *
 * `draftIndex` is what makes the per-row answer selector possible: the paste
 * paths have no editable source (the textarea *is* the source), but a document
 * import's drafts live in state, so a row can write back into the exact draft it
 * was validated from.
 */
export type PreviewRow = { row: RowResult; draftIndex: number | null };

/** What the vision run is doing, so the panel can show it without a second state. */
export type VisionState = {
  file: File;
  pages: number;
  from: number;
  to: number;
  running: boolean;
  progress: {
    page: number;
    done: number;
    total: number;
    found: number;
    stage: 1 | 2;
    stageLabel: "Extract" | "Recheck";
    stage1Done: number;
    stage2Done: number;
  } | null;
};

export type FixProgress = {
  index: number;
  total: number;
  draftNumber: number;
  stage: 1 | 2;
  stageLabel: "Fix" | "Recheck";
  stage1Done: number;
  stage2Done: number;
  fixed: number;
  failed: number;
};

export type FigureProgress = {
  index: number;
  total: number;
  draftNumber: number;
  stage: 1 | 2;
  stageLabel: "Locate" | "Recheck";
  stage1Done: number;
  stage2Done: number;
  attached: number;
  failed: number;
};
