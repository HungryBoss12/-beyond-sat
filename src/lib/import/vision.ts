import { extractPageWithGemini } from "./gemini-client";
import { renderPdfPages, pdfPageCount } from "./pdf";
import type { Draft, ParseDefaults } from "./parse";
import { skillsFor, type Section } from "@/lib/sat";

/**
 * Scanned-PDF import: render a page → Gemini extract → Gemini recheck → drafts.
 *
 * Numbers, skills, and section labels are optional. Missing numbers are assigned
 * sequentially after the run so the preview still has stable row IDs.
 */

export type VisionStageId = 1 | 2;

export type VisionProgress = {
  page: number;
  pagesDone: number;
  pagesTotal: number;
  questionsFound: number;
  /** 1 = extract (Pro), 2 = recheck (Flash). */
  stage: VisionStageId;
  stageLabel: "Extract" | "Recheck";
  /** Pages completed through stage 1. */
  stage1Done: number;
  /** Pages completed through stage 2. */
  stage2Done: number;
};

export type VisionRun = {
  drafts: Draft[];
  notes: string[];
  stopped: boolean;
  pagesRead: number;
};

function extractJsonArray(text: string): unknown[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function asText(value: unknown): string {
  if (value == null) return "";
  if (Array.isArray(value)) return value.map((v) => String(v)).join(", ");
  if (typeof value === "object") return "";
  return String(value);
}

/** Fingerprint for dedupe when printed numbers are missing or unreliable. */
function contentKey(rec: Record<string, string>): string {
  const text = (rec.question_text || "").toLowerCase().replace(/\s+/g, " ").trim();
  const choices = ["A", "B", "C", "D"]
    .map((l) => (rec[`choice_${l}`] || "").toLowerCase().replace(/\s+/g, " ").trim())
    .join("|");
  return `${text}::${choices}`.slice(0, 400);
}

function itemToDraft(
  item: Record<string, unknown>,
  fallbackNumber: number,
  defaults: ParseDefaults,
): Draft | null {
  const warnings: string[] = [];

  const questionText = asText(item.question_text ?? item.question ?? item.text).trim();
  if (!questionText) return null;

  const rawNumber = Number(item.number ?? item.question_number ?? NaN);
  const hasPrintedNumber = Number.isFinite(rawNumber) && rawNumber > 0;
  const number = hasPrintedNumber ? Math.round(rawNumber) : fallbackNumber;
  if (!hasPrintedNumber) {
    warnings.push("No printed number on the page — assigned a temporary number for this import.");
  }

  const section: Section =
    item.section === "math" || item.section === "reading_writing"
      ? (item.section as Section)
      : defaults.section;

  const valid = skillsFor(section);
  const claimed = asText(item.skill).trim();
  let skill = defaults.skill;
  if (valid.includes(claimed)) skill = claimed;
  else if (claimed) {
    /* Soft: ignore invalid taxonomy instead of failing the row. */
    warnings.push(`Skill "${claimed}" isn't in this section's list — using "${defaults.skill}".`);
  }

  const choices = Array.isArray(item.choices)
    ? item.choices.map((c) => asText(c).trim()).filter(Boolean)
    : [];

  const kindRaw = asText(item.kind).trim();
  const kind =
    kindRaw === "grid_in" || (kindRaw !== "multiple_choice" && choices.length === 0)
      ? "grid_in"
      : "multiple_choice";

  const rec: Record<string, string> = {
    section,
    skill,
    difficulty: defaults.difficulty,
    kind,
    prompt: asText(item.prompt),
    question_text: questionText,
    correct: asText(item.correct ?? item.answer).trim(),
    explanation: asText(item.explanation),
    source_month: defaults.source_month,
    source_year: defaults.source_year,
  };
  choices.slice(0, 8).forEach((text, i) => {
    rec[`choice_${String.fromCharCode(65 + i)}`] = text;
  });

  if (rec.prompt.includes("[FIGURE NEEDED")) {
    warnings.push(
      "This question depends on a figure. Add an image URL, or the question will be unanswerable.",
    );
  }

  return { number, rec, warnings };
}

export async function pageCount(file: Blob): Promise<number> {
  return pdfPageCount(file);
}

/**
 * Two-stage vision extraction over a page range.
 *
 * Stage 1 (Pro): find and transcribe questions.
 * Stage 2 (Flash): recheck against the same image and correct misses.
 */
export async function extractByVision(
  file: Blob,
  opts: {
    defaults: ParseDefaults;
    from?: number;
    to?: number;
    signal?: AbortSignal;
    shouldStop?: () => boolean;
    onProgress?: (progress: VisionProgress) => void;
  },
): Promise<VisionRun> {
  const drafts: Draft[] = [];
  const notes: string[] = [];
  let consecutiveFailures = 0;
  let pagesRead = 0;
  let lastPage = 0;
  let stage1Done = 0;
  let stage2Done = 0;

  const result = await renderPdfPages(file, {
    from: opts.from,
    to: opts.to,
    shouldStop: opts.shouldStop,
    onPage: async (image, index, total) => {
      pagesRead++;
      lastPage = image.page;

      const report = (stage: VisionStageId, found: number) => {
        opts.onProgress?.({
          page: image.page,
          pagesDone: index + 1,
          pagesTotal: total,
          questionsFound: found,
          stage,
          stageLabel: stage === 1 ? "Extract" : "Recheck",
          stage1Done,
          stage2Done,
        });
      };

      let extracted: string;
      try {
        report(1, drafts.length);
        extracted = await extractPageWithGemini(image.dataUrl, {
          signal: opts.signal,
          stage: "extract",
        });
        stage1Done++;
        report(1, drafts.length);
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        consecutiveFailures++;
        notes.push(
          `Page ${image.page} (extract): ${(err as Error)?.message ?? "the request failed"}.`,
        );
        if (consecutiveFailures >= 3) {
          notes.push(
            `Stopped at page ${image.page} after three failed pages in a row — the model is rate-limiting or unavailable. Everything read so far is below; start the next run from page ${image.page - 2}.`,
          );
          throw new StopRun();
        }
        report(1, drafts.length);
        return;
      }

      let content = extracted;
      try {
        report(2, drafts.length);
        content = await extractPageWithGemini(image.dataUrl, {
          signal: opts.signal,
          stage: "recheck",
          priorExtraction: extracted,
        });
        stage2Done++;
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        notes.push(
          `Page ${image.page} (recheck): ${(err as Error)?.message ?? "recheck failed"} — using extract result.`,
        );
        stage2Done++;
      }

      consecutiveFailures = 0;
      const items = extractJsonArray(content) ?? extractJsonArray(extracted);
      if (!items) {
        notes.push(`Page ${image.page}: the model didn't return usable JSON — skipped.`);
      } else {
        for (const raw of items) {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
          const draft = itemToDraft(
            raw as Record<string, unknown>,
            drafts.length + 1,
            opts.defaults,
          );
          if (draft) drafts.push(draft);
        }
      }
      report(2, drafts.length);
    },
  }).catch((err) => {
    if (err instanceof StopRun) return { rendered: pagesRead, total: pagesRead, stopped: true };
    throw err;
  });

  /* Dedupe by printed number when both have one; otherwise by question text. */
  const byNumber = new Map<number, Draft>();
  const byContent = new Map<string, Draft>();
  const unique: Draft[] = [];

  for (const d of drafts) {
    const key = contentKey(d.rec);
    const warnNoNum = d.warnings.some((w) => w.includes("No printed number"));
    if (!warnNoNum && byNumber.has(d.number)) continue;
    if (byContent.has(key)) continue;
    if (!warnNoNum) byNumber.set(d.number, d);
    byContent.set(key, d);
    unique.push(d);
  }

  if (unique.length !== drafts.length) {
    notes.push(
      `${drafts.length - unique.length} duplicate question(s) across page boundaries were dropped.`,
    );
  }

  /* Renumber gaps: keep printed numbers, fill missing with the next free ints. */
  const used = new Set(
    unique
      .filter((d) => !d.warnings.some((w) => w.includes("No printed number")))
      .map((d) => d.number),
  );
  let next = 1;
  for (const d of unique) {
    if (d.warnings.some((w) => w.includes("No printed number"))) {
      while (used.has(next)) next++;
      d.number = next;
      used.add(next);
      next++;
    }
  }

  unique.sort((a, b) => a.number - b.number);
  notes.unshift(
    `Read ${unique.length} question${unique.length === 1 ? "" : "s"} from ${pagesRead} page(s) (extract + recheck).`,
  );
  if (result.stopped && lastPage) {
    notes.push(
      `Stopped at page ${lastPage}. Run the rest by setting the page range to start at ${lastPage + 1}.`,
    );
  }

  return { drafts: unique, notes, stopped: result.stopped, pagesRead };
}

class StopRun extends Error {
  constructor() {
    super("stopped");
    this.name = "StopRun";
  }
}
