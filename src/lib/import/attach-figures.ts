import { supabase } from "@/integrations/supabase/client";
import type { Draft } from "./parse";
import {
  cloneDraft,
  diffRec,
  makeActivityEntry,
  type ActivityEntry,
} from "./activity-log";
import {
  cropPageToBlob,
  filterConfidentBoxes,
  parseFigureBoxes,
  unionBoxesForDraft,
  type FigureBox,
} from "./crop-figure";
import { needsFigure } from "./figure-dependency";
import { FIGURE_MARKER } from "./docx";
import { uploadQuestionImage } from "./upload-question-image";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to attach figures.");
  return { Authorization: `Bearer ${token}` };
}

export type FigureQuestionHint = {
  draft_number: number;
  stem: string;
};

export async function locateFiguresWithGemini(
  imageDataUrl: string,
  opts: {
    signal?: AbortSignal;
    hint?: string;
    questions?: FigureQuestionHint[];
    tableMarkdown?: boolean;
  } = {},
): Promise<string> {
  const response = await fetch("/api/import/figure", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({
      imageDataUrl,
      hint: opts.hint,
      questions: opts.questions,
      tableMarkdown: opts.tableMarkdown === true,
    }),
  });

  const data = (await response.json().catch(() => null)) as {
    content?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Figure attach is unavailable.");
  }
  return data?.content ?? "";
}

export { needsFigure } from "./figure-dependency";

export type AttachFigureProgress = {
  page: number;
  pagesDone: number;
  pagesTotal: number;
  draftNumber: number;
  attached: number;
  failed: number;
};

export type AttachFigureReason = "required" | "sweep";

export type AttachFigureTarget = {
  draftIndex: number;
  draft: Draft;
  /** required = missing figure is an error; sweep = opportunistic. */
  reason: AttachFigureReason;
};

const CROP_RENDER_SCALE = 2;
const CROP_RENDER_QUALITY = 0.92;

function hasFigureImage(rec: Record<string, string>): boolean {
  return (rec.image_url ?? "").trim().length > 0;
}

function applyFigureToDraft(
  draft: Draft,
  opts: { url?: string; caption?: string; markdown?: string },
): Draft {
  const rec: Record<string, string> = { ...draft.rec };
  if (opts.url) rec.image_url = opts.url;

  const caption = opts.caption?.trim() ?? "";
  const markdown = opts.markdown?.trim() ?? "";

  if (!(rec.prompt ?? "").trim()) {
    const parts: string[] = [];
    if (caption) parts.push(`Figure: ${caption}`);
    else if (opts.url) parts.push("Figure");
    if (markdown) parts.push(markdown);
    if (parts.length) rec.prompt = parts.join("\n\n");
  } else {
    let prompt = (rec.prompt ?? "")
      .replace(/\[FIGURE NEEDED:[^\]]*\]/gi, caption ? `[Figure: ${caption}]` : "[Figure attached]")
      .replace(/\[FIGURE NEEDED[^\]]*\]/gi, caption ? `[Figure: ${caption}]` : "[Figure attached]")
      .replaceAll(FIGURE_MARKER, caption ? `[Figure: ${caption}]` : "[Figure attached]");
    if (markdown && !prompt.includes(markdown)) {
      prompt = `${prompt.trim()}\n\n${markdown}`.trim();
    }
    rec.prompt = prompt;
  }

  const warnings = draft.warnings.filter(
    (w) =>
      !w.toLowerCase().includes("figure") &&
      !w.toLowerCase().includes("image url") &&
      !w.toLowerCase().includes("unanswerable"),
  );
  if (opts.url) {
    warnings.push("Figure attached from the source.");
  } else if (markdown) {
    warnings.push("Table transcribed as text (no crop).");
  }
  return { ...draft, rec, warnings, reviewed: false, sourceImages: undefined };
}

function kindLabel(box: FigureBox): string {
  return box.kind ?? "figure";
}

/**
 * Crop figures from each draft's source PDF page, upload, and set image_url.
 * Renders each page once and locates all figures on that page in one vision call.
 */
export async function attachFiguresToDrafts(
  file: File,
  allDrafts: Draft[],
  targets: AttachFigureTarget[],
  opts: {
    signal?: AbortSignal;
    shouldStop?: () => boolean;
    onProgress?: (p: AttachFigureProgress) => void;
    tableMarkdown?: boolean;
  } = {},
): Promise<{
  drafts: Draft[];
  notes: string[];
  entries: ActivityEntry[];
  attached: number;
  failed: number;
}> {
  const next: Draft[] = allDrafts.map((d) => ({
    ...d,
    rec: { ...d.rec },
    warnings: [...d.warnings],
    sourceImages: d.sourceImages ? [...d.sourceImages] : undefined,
  }));
  const notes: string[] = [];
  const entries: ActivityEntry[] = [];
  let attached = 0;
  let failed = 0;

  const { renderPdfPage } = await import("./pdf");
  const pageCache = new Map<number, string>();

  const byPage = new Map<number, AttachFigureTarget[]>();
  for (const t of targets) {
    if (hasFigureImage(t.draft.rec) && t.reason === "sweep") continue;
    const page = t.draft.sourcePage;
    if (page == null || page < 1) {
      if (t.reason === "required") {
        failed++;
        notes.push(`Q${t.draft.number}: no source page to crop from.`);
      }
      continue;
    }
    const list = byPage.get(page) ?? [];
    list.push(t);
    byPage.set(page, list);
  }

  const pages = [...byPage.keys()].sort((a, b) => a - b);
  let pagesDone = 0;

  for (const page of pages) {
    if (opts.shouldStop?.()) break;
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const pageTargets = byPage.get(page) ?? [];
    let pageUrl = pageCache.get(page);
    if (!pageUrl) {
      try {
        pageUrl = await renderPdfPage(file, page, {
          scale: CROP_RENDER_SCALE,
          quality: CROP_RENDER_QUALITY,
        });
        pageCache.set(page, pageUrl);
      } catch (err) {
        for (const t of pageTargets) {
          if (t.reason === "required") {
            failed++;
            notes.push(
              `Q${t.draft.number}: ${(err as Error)?.message ?? "the page could not be rendered"}.`,
            );
          }
        }
        pagesDone++;
        continue;
      }
    }

    const questions: FigureQuestionHint[] = pageTargets.map((t) => ({
      draft_number: t.draft.number,
      stem: (t.draft.rec.question_text ?? "").trim().slice(0, 160),
    }));

    let locationJson: string;
    try {
      locationJson = await locateFiguresWithGemini(pageUrl, {
        signal: opts.signal,
        questions,
        tableMarkdown: opts.tableMarkdown,
      });
    } catch (err) {
      for (const t of pageTargets) {
        if (t.reason === "required") {
          failed++;
          notes.push(`Q${t.draft.number} (locate): ${(err as Error)?.message ?? "locate failed"}.`);
        }
      }
      pagesDone++;
      continue;
    }

    const boxes = filterConfidentBoxes(parseFigureBoxes(locationJson));

    for (const t of pageTargets) {
      if (opts.shouldStop?.()) break;
      if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

      opts.onProgress?.({
        page,
        pagesDone,
        pagesTotal: pages.length,
        draftNumber: t.draft.number,
        attached,
        failed,
      });

      if (hasFigureImage(next[t.draftIndex].rec)) continue;

      const box = unionBoxesForDraft(boxes, t.draft.number);
      if (!box) {
        if (t.reason === "required") {
          failed++;
          notes.push(`Q${t.draft.number}: no figure was found on page ${page}.`);
        } else {
          notes.push(`Q${t.draft.number}: no figure found on page ${page} — skipped.`);
        }
        continue;
      }

      const snapshot = cloneDraft(next[t.draftIndex]);
      const markdown = opts.tableMarkdown && box.kind === "table" ? box.markdown : undefined;

      try {
        const blob = await cropPageToBlob(pageUrl, box);
        const url = await uploadQuestionImage(blob, `figure-q${t.draft.number}.png`);
        next[t.draftIndex] = applyFigureToDraft(next[t.draftIndex], {
          url,
          caption: box.caption,
          markdown,
        });
        attached++;
        entries.push(
          makeActivityEntry({
            actor: "crop",
            draftIndex: t.draftIndex,
            draftNumber: t.draft.number,
            summary: `Cropped the ${kindLabel(box)} on page ${page} into Q${t.draft.number}'s figure${
              markdown ? " (+ table text)" : ""
            }.`,
            fields: diffRec(snapshot.rec, next[t.draftIndex].rec),
            snapshot,
          }),
        );
        entries.push(
          makeActivityEntry({
            actor: "gemini-locate",
            draftIndex: t.draftIndex,
            draftNumber: t.draft.number,
            summary: `Located ${kindLabel(box)} for Q${t.draft.number} on page ${page}${
              box.caption ? `: ${box.caption}` : ""
            }.`,
          }),
        );
      } catch (err) {
        if (markdown) {
          next[t.draftIndex] = applyFigureToDraft(next[t.draftIndex], {
            caption: box.caption,
            markdown,
          });
          attached++;
          entries.push(
            makeActivityEntry({
              actor: "gemini-locate",
              draftIndex: t.draftIndex,
              draftNumber: t.draft.number,
              summary: `Crop failed for Q${t.draft.number}; used table text instead.`,
              fields: diffRec(snapshot.rec, next[t.draftIndex].rec),
              snapshot,
            }),
          );
          notes.push(
            `Q${t.draft.number}: crop failed (${(err as Error)?.message ?? "error"}) — table text kept.`,
          );
        } else if (t.reason === "required") {
          failed++;
          notes.push(`Q${t.draft.number}: figure attach failed — ${(err as Error)?.message ?? "upload failed"}.`);
        } else {
          notes.push(
            `Q${t.draft.number}: figure skipped — ${(err as Error)?.message ?? "upload failed"}.`,
          );
        }
      }
    }

    pagesDone++;
  }

  notes.unshift(
    `Figures: attached ${attached} of ${targets.length}${failed ? ` (${failed} failed)` : ""}.`,
  );

  return { drafts: next, notes, entries, attached, failed };
}

/**
 * Upload embedded DOCX images preserved on drafts during parse.
 */
export async function attachDocxImagesToDrafts(
  drafts: Draft[],
): Promise<{
  drafts: Draft[];
  notes: string[];
  entries: ActivityEntry[];
  attached: number;
  failed: number;
}> {
  const { composeSourceImages } = await import("./compose-images");
  const next: Draft[] = drafts.map((d) => ({
    ...d,
    rec: { ...d.rec },
    warnings: [...d.warnings],
    sourceImages: d.sourceImages ? [...d.sourceImages] : undefined,
  }));
  const notes: string[] = [];
  const entries: ActivityEntry[] = [];
  let attached = 0;
  let failed = 0;

  for (let i = 0; i < next.length; i++) {
    const draft = next[i];
    if (!draft.sourceImages?.length || hasFigureImage(draft.rec)) continue;
    const snapshot = cloneDraft(draft);
    try {
      const blob = await composeSourceImages(draft.sourceImages);
      const url = await uploadQuestionImage(blob, `docx-q${draft.number}.png`);
      next[i] = applyFigureToDraft(draft, { url });
      attached++;
      entries.push(
        makeActivityEntry({
          actor: "crop",
          draftIndex: i,
          draftNumber: draft.number,
          summary: `Attached embedded DOCX image to Q${draft.number}.`,
          fields: diffRec(snapshot.rec, next[i].rec),
          snapshot,
        }),
      );
    } catch (err) {
      failed++;
      notes.push(`Q${draft.number}: ${(err as Error)?.message ?? "embedded image upload failed"}.`);
    }
  }

  if (attached || failed) {
    notes.unshift(`DOCX figures: attached ${attached}${failed ? ` (${failed} failed)` : ""}.`);
  }

  return { drafts: next, notes, entries, attached, failed };
}

/** Attach a manual crop from normalized page coordinates. */
export async function attachManualCropToDraft(
  file: File,
  draft: Draft,
  box: { x: number; y: number; w: number; h: number; caption?: string },
  draftIndex = -1,
): Promise<{ draft: Draft; entry: ActivityEntry }> {
  const page = draft.sourcePage;
  if (page == null || page < 1) {
    throw new Error("This question has no source page to crop from.");
  }
  const snapshot = cloneDraft(draft);
  const { renderPdfPage } = await import("./pdf");
  const pageUrl = await renderPdfPage(file, page, {
    scale: CROP_RENDER_SCALE,
    quality: CROP_RENDER_QUALITY,
  });
  const blob = await cropPageToBlob(pageUrl, box);
  const url = await uploadQuestionImage(blob, `manual-q${draft.number}.png`);
  const updated = applyFigureToDraft(draft, { url, caption: box.caption });
  const entry = makeActivityEntry({
    actor: "admin",
    draftIndex,
    draftNumber: draft.number,
    summary: `Manually cropped page ${page} into Q${draft.number}'s figure.`,
    fields: diffRec(snapshot.rec, updated.rec),
    snapshot,
  });
  return { draft: updated, entry };
}
