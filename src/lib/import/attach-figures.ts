import { supabase } from "@/integrations/supabase/client";
import type { Draft } from "./parse";
import { cropPageToBlob, parseFigureBoxes, unionBoxesForDraft } from "./crop-figure";
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

export type AttachFigureTarget = {
  draftIndex: number;
  draft: Draft;
};

const CROP_RENDER_SCALE = 2;
const CROP_RENDER_QUALITY = 0.92;

function applyFigureToDraft(draft: Draft, url: string, caption?: string): Draft {
  const rec: Record<string, string> = { ...draft.rec, image_url: url };
  if (!(rec.prompt ?? "").trim()) {
    rec.prompt = caption ? `Figure: ${caption}` : "Figure";
  } else {
    rec.prompt = (rec.prompt ?? "")
      .replace(/\[FIGURE NEEDED:[^\]]*\]/gi, caption ? `[Figure: ${caption}]` : "[Figure attached]")
      .replace(/\[FIGURE NEEDED[^\]]*\]/gi, caption ? `[Figure: ${caption}]` : "[Figure attached]")
      .replaceAll(FIGURE_MARKER, caption ? `[Figure: ${caption}]` : "[Figure attached]");
  }
  const warnings = draft.warnings.filter(
    (w) =>
      !w.toLowerCase().includes("figure") &&
      !w.toLowerCase().includes("image url") &&
      !w.toLowerCase().includes("unanswerable"),
  );
  warnings.push("Figure attached from the source.");
  return { ...draft, rec, warnings, reviewed: false, sourceImages: undefined };
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
  } = {},
): Promise<{ drafts: Draft[]; notes: string[]; attached: number; failed: number }> {
  const next: Draft[] = allDrafts.map((d) => ({
    ...d,
    rec: { ...d.rec },
    warnings: [...d.warnings],
    sourceImages: d.sourceImages ? [...d.sourceImages] : undefined,
  }));
  const notes: string[] = [];
  let attached = 0;
  let failed = 0;

  const { renderPdfPage } = await import("./pdf");
  const pageCache = new Map<number, string>();

  const byPage = new Map<number, AttachFigureTarget[]>();
  for (const t of targets) {
    const page = t.draft.sourcePage;
    if (page == null || page < 1) {
      failed++;
      notes.push(`Q${t.draft.number}: no source page to crop from.`);
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
          failed++;
          notes.push(
            `Q${t.draft.number}: ${(err as Error)?.message ?? "the page could not be rendered"}.`,
          );
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
      });
    } catch (err) {
      for (const t of pageTargets) {
        failed++;
        notes.push(`Q${t.draft.number} (locate): ${(err as Error)?.message ?? "locate failed"}.`);
      }
      pagesDone++;
      continue;
    }

    const boxes = parseFigureBoxes(locationJson);

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

      const box = unionBoxesForDraft(boxes, t.draft.number);
      if (!box) {
        failed++;
        notes.push(`Q${t.draft.number}: no figure was found on page ${page}.`);
        continue;
      }

      try {
        const blob = await cropPageToBlob(pageUrl, box);
        const url = await uploadQuestionImage(blob, `figure-q${t.draft.number}.png`);
        next[t.draftIndex] = applyFigureToDraft(next[t.draftIndex], url, box.caption);
        attached++;
      } catch (err) {
        failed++;
        notes.push(`Q${t.draft.number}: ${(err as Error)?.message ?? "upload failed"}.`);
      }
    }

    pagesDone++;
  }

  notes.unshift(
    `Figures: attached ${attached} of ${targets.length}${failed ? ` (${failed} failed)` : ""}.`,
  );

  return { drafts: next, notes, attached, failed };
}

/**
 * Upload embedded DOCX images preserved on drafts during parse.
 */
export async function attachDocxImagesToDrafts(
  drafts: Draft[],
): Promise<{ drafts: Draft[]; notes: string[]; attached: number; failed: number }> {
  const { composeSourceImages } = await import("./compose-images");
  const next: Draft[] = drafts.map((d) => ({
    ...d,
    rec: { ...d.rec },
    warnings: [...d.warnings],
    sourceImages: d.sourceImages ? [...d.sourceImages] : undefined,
  }));
  const notes: string[] = [];
  let attached = 0;
  let failed = 0;

  for (let i = 0; i < next.length; i++) {
    const draft = next[i];
    if (!draft.sourceImages?.length || hasFigureImage(draft.rec)) continue;
    try {
      const blob = await composeSourceImages(draft.sourceImages);
      const url = await uploadQuestionImage(blob, `docx-q${draft.number}.png`);
      next[i] = applyFigureToDraft(draft, url);
      attached++;
    } catch (err) {
      failed++;
      notes.push(`Q${draft.number}: ${(err as Error)?.message ?? "embedded image upload failed"}.`);
    }
  }

  if (attached || failed) {
    notes.unshift(`DOCX figures: attached ${attached}${failed ? ` (${failed} failed)` : ""}.`);
  }

  return { drafts: next, notes, attached, failed };
}

function hasFigureImage(rec: Record<string, string>): boolean {
  return (rec.image_url ?? "").trim().length > 0;
}

/** Attach a manual crop from normalized page coordinates. */
export async function attachManualCropToDraft(
  file: File,
  draft: Draft,
  box: { x: number; y: number; w: number; h: number; caption?: string },
): Promise<Draft> {
  const page = draft.sourcePage;
  if (page == null || page < 1) {
    throw new Error("This question has no source page to crop from.");
  }
  const { renderPdfPage } = await import("./pdf");
  const pageUrl = await renderPdfPage(file, page, {
    scale: CROP_RENDER_SCALE,
    quality: CROP_RENDER_QUALITY,
  });
  const blob = await cropPageToBlob(pageUrl, box);
  const url = await uploadQuestionImage(blob, `manual-q${draft.number}.png`);
  return applyFigureToDraft(draft, url, box.caption);
}
