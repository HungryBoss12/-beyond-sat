import { supabase } from "@/integrations/supabase/client";
import type { Draft } from "./parse";
import { cropPageToBlob, parseFigureBoxes, unionBoxes } from "./crop-figure";
import { uploadQuestionImage } from "./upload-question-image";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to attach figures.");
  return { Authorization: `Bearer ${token}` };
}

export type FigureClientStage = "extract" | "recheck";

export async function locateFiguresWithGemini(
  imageDataUrl: string,
  opts: {
    signal?: AbortSignal;
    stage?: FigureClientStage;
    priorLocation?: string;
    hint?: string;
  } = {},
): Promise<string> {
  const response = await fetch("/api/import/figure", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({
      imageDataUrl,
      stage: opts.stage ?? "extract",
      priorLocation: opts.priorLocation,
      hint: opts.hint,
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

export function needsFigure(draft: Draft): boolean {
  const hasImage = (draft.rec.image_url ?? "").trim().length > 0;
  if (hasImage) return false;
  return (draft.rec.prompt ?? "").includes("[FIGURE NEEDED");
}

export type AttachFigureProgress = {
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

export type AttachFigureTarget = {
  draftIndex: number;
  draft: Draft;
};

/**
 * Crop figures from each draft's source PDF page, upload, and set image_url.
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
  const next = allDrafts.map((d) => ({ ...d, rec: { ...d.rec }, warnings: [...d.warnings] }));
  const notes: string[] = [];
  let attached = 0;
  let failed = 0;
  let stage1Done = 0;
  let stage2Done = 0;

  const { renderPdfPage } = await import("./pdf");

  for (let i = 0; i < targets.length; i++) {
    if (opts.shouldStop?.()) break;
    if (opts.signal?.aborted) throw new DOMException("Aborted", "AbortError");

    const t = targets[i];
    const page = t.draft.sourcePage;
    const report = (stage: 1 | 2) => {
      opts.onProgress?.({
        index: i + 1,
        total: targets.length,
        draftNumber: t.draft.number,
        stage,
        stageLabel: stage === 1 ? "Locate" : "Recheck",
        stage1Done,
        stage2Done,
        attached,
        failed,
      });
    };

    if (page == null || page < 1) {
      failed++;
      notes.push(`Q${t.draft.number}: no source page to crop from.`);
      continue;
    }

    let pageUrl: string;
    try {
      pageUrl = await renderPdfPage(file, page);
    } catch (err) {
      failed++;
      notes.push(
        `Q${t.draft.number}: ${(err as Error)?.message ?? "the page could not be rendered"}.`,
      );
      continue;
    }

    const hint = (t.draft.rec.prompt ?? "").trim();
    let first: string;
    try {
      report(1);
      first = await locateFiguresWithGemini(pageUrl, {
        signal: opts.signal,
        stage: "extract",
        hint,
      });
      stage1Done++;
      report(1);
    } catch (err) {
      failed++;
      notes.push(`Q${t.draft.number} (locate): ${(err as Error)?.message ?? "locate failed"}.`);
      report(1);
      continue;
    }

    let content = first;
    try {
      report(2);
      content = await locateFiguresWithGemini(pageUrl, {
        signal: opts.signal,
        stage: "recheck",
        priorLocation: first,
        hint,
      });
      stage2Done++;
    } catch (err) {
      notes.push(
        `Q${t.draft.number} (recheck): ${(err as Error)?.message ?? "recheck failed"} — using locate result.`,
      );
      stage2Done++;
    }

    const box = unionBoxes(parseFigureBoxes(content)) ?? unionBoxes(parseFigureBoxes(first));
    if (!box) {
      failed++;
      notes.push(`Q${t.draft.number}: no figure was found on the page.`);
      report(2);
      continue;
    }

    try {
      const blob = await cropPageToBlob(pageUrl, box);
      const url = await uploadQuestionImage(blob, `figure-q${t.draft.number}.jpg`);
      const rec: Record<string, string> = { ...next[t.draftIndex].rec, image_url: url };
      if (!(rec.prompt ?? "").trim()) {
        rec.prompt = box.caption ? `Figure: ${box.caption}` : "Figure";
      } else if (rec.prompt.includes("[FIGURE NEEDED")) {
        rec.prompt = rec.prompt
          .replace(
            /\[FIGURE NEEDED:[^\]]*\]/g,
            box.caption ? `[Figure: ${box.caption}]` : "[Figure attached]",
          )
          .replace(
            /\[FIGURE NEEDED[^\]]*\]/g,
            box.caption ? `[Figure: ${box.caption}]` : "[Figure attached]",
          );
      }
      const warnings = next[t.draftIndex].warnings.filter(
        (w) => !w.toLowerCase().includes("figure") && !w.toLowerCase().includes("image url"),
      );
      warnings.push("Figure cropped from the source page and attached.");
      next[t.draftIndex] = { ...next[t.draftIndex], rec, warnings, reviewed: false };
      attached++;
    } catch (err) {
      failed++;
      notes.push(`Q${t.draft.number}: ${(err as Error)?.message ?? "upload failed"}.`);
    }
    report(2);
  }

  notes.unshift(
    `Figures: attached ${attached} of ${targets.length}${failed ? ` (${failed} failed)` : ""}.`,
  );

  return { drafts: next, notes, attached, failed };
}
