import { askWithImage } from "@/lib/ai/client";
import { VISION_EXTRACTION_PROMPT } from "@/lib/ai/prompts";
import { renderPdfPages, pdfPageCount } from "./pdf";
import type { Draft, ParseDefaults } from "./parse";
import { skillsFor, type Section } from "@/lib/sat";

/**
 * The scanned-PDF import path: render a page, send it to the vision model, turn
 * the JSON back into drafts.
 *
 * Only reached when `readPdfText` finds no text layer. A text PDF goes through
 * the deterministic reader — this costs a model call per page and can be wrong,
 * so it is the fallback, never the default.
 *
 * **One page at a time.** The 108-page sample fired concurrently at a `:free`
 * model rate-limits within seconds and burns the whole document with nothing to
 * show for it. Sequential, with a page range and a Stop button, is the only
 * version of this that finishes.
 */

export type VisionProgress = {
  page: number;
  pagesDone: number;
  pagesTotal: number;
  questionsFound: number;
};

export type VisionRun = {
  drafts: Draft[];
  /** Per-page problems, shown above the preview rather than thrown. */
  notes: string[];
  stopped: boolean;
  pagesRead: number;
};

/**
 * Pull a JSON array out of a model response.
 *
 * The prompt asks for a bare array and most responses are one, but a free-tier
 * model will occasionally wrap it in a ```json fence or open with "Here is the
 * extracted data:". Slicing between the first `[` and the last `]` handles both
 * without a second round trip — and if there's no array at all, that's a page
 * note, not an exception, because one confused page must not abort a 40-page run.
 */
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

/**
 * One model object → one draft record.
 *
 * Section and skill are validated against the section the admin chose rather
 * than trusted: a vision model reliably reads the words on the page and much
 * less reliably picks a taxonomy label, and a Math skill on a Reading row is a
 * row the importer rejects with an error the editor then has to hand-fix.
 */
function itemToDraft(item: Record<string, unknown>, fallbackNumber: number, defaults: ParseDefaults): Draft {
  const warnings: string[] = [];

  const rawNumber = Number(item.number ?? item.question_number ?? NaN);
  const number = Number.isFinite(rawNumber) && rawNumber > 0 ? Math.round(rawNumber) : fallbackNumber;
  if (!Number.isFinite(rawNumber)) {
    warnings.push("The model didn't give a question number — an answer key won't match this row.");
  }

  const section: Section =
    item.section === "math" || item.section === "reading_writing"
      ? (item.section as Section)
      : defaults.section;

  const valid = skillsFor(section);
  const claimed = asText(item.skill).trim();
  let skill = defaults.skill;
  if (valid.includes(claimed)) skill = claimed;
  else if (claimed) warnings.push(`Skill "${claimed}" isn't valid for this section — using "${defaults.skill}".`);

  const choices = Array.isArray(item.choices)
    ? item.choices.map((c) => asText(c).trim()).filter(Boolean)
    : [];

  const rec: Record<string, string> = {
    section,
    skill,
    difficulty: defaults.difficulty,
    kind: choices.length > 0 ? "multiple_choice" : "grid_in",
    prompt: asText(item.prompt),
    question_text: asText(item.question_text ?? item.question ?? item.text).trim(),
    correct: asText(item.correct ?? item.answer).trim(),
    explanation: asText(item.explanation),
    source_month: defaults.source_month,
    source_year: defaults.source_year,
  };
  choices.slice(0, 8).forEach((text, i) => {
    rec[`choice_${String.fromCharCode(65 + i)}`] = text;
  });

  if (!rec.question_text) warnings.push("The model returned no question text for this row.");
  if (rec.prompt.includes("[FIGURE NEEDED")) {
    warnings.push("This question depends on a figure. Add an image URL, or the question will be unanswerable.");
  }

  return { number, rec, warnings };
}

export async function pageCount(file: Blob): Promise<number> {
  return pdfPageCount(file);
}

/**
 * Run the vision extraction over a page range.
 *
 * `shouldStop` is polled between pages and the same signal aborts the in-flight
 * request, so Stop takes effect on the current page rather than after it. Every
 * page that fails — a rate limit, a timeout, unparseable output — is recorded as
 * a note and the run continues: on a free tier, one 429 in the middle of a long
 * document is expected, and losing 40 successful pages to it is not acceptable.
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
  /* Counted here rather than taken from the return value, because bailing out
     early unwinds `renderPdfPages` and loses its own tally. */
  let pagesRead = 0;
  let lastPage = 0;

  const result = await renderPdfPages(file, {
    from: opts.from,
    to: opts.to,
    shouldStop: opts.shouldStop,
    onPage: async (image, index, total) => {
      pagesRead++;
      lastPage = image.page;
      let content: string;
      try {
        content = await askWithImage(VISION_EXTRACTION_PROMPT, image.dataUrl, {
          task: "vision",
          signal: opts.signal,
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") throw err;
        consecutiveFailures++;
        notes.push(`Page ${image.page}: ${(err as Error)?.message ?? "the request failed"}.`);
        /* Three in a row is a rate limit or a dead key, not a bad page. Carrying
           on would send another hundred requests to something that is answering
           none of them. */
        if (consecutiveFailures >= 3) {
          notes.push(
            `Stopped at page ${image.page} after three failed pages in a row — the model is rate-limiting or unavailable. Everything read so far is below; start the next run from page ${image.page - 2}.`,
          );
          throw new StopRun();
        }
        opts.onProgress?.({ page: image.page, pagesDone: index + 1, pagesTotal: total, questionsFound: drafts.length });
        return;
      }

      consecutiveFailures = 0;
      const items = extractJsonArray(content);
      if (!items) {
        notes.push(`Page ${image.page}: the model didn't return usable JSON — skipped.`);
      } else {
        for (const raw of items) {
          if (!raw || typeof raw !== "object" || Array.isArray(raw)) continue;
          drafts.push(itemToDraft(raw as Record<string, unknown>, drafts.length + 1, opts.defaults));
        }
      }
      opts.onProgress?.({ page: image.page, pagesDone: index + 1, pagesTotal: total, questionsFound: drafts.length });
    },
  }).catch((err) => {
    if (err instanceof StopRun) return { rendered: pagesRead, total: pagesRead, stopped: true };
    throw err;
  });

  /* Pages are extracted independently, so the same question can come back twice
     when a passage spans a page break and the model repeats it. Keyed on the
     printed number, first copy wins — the earlier page is the one that had the
     question's own choices on it. */
  const seen = new Set<number>();
  const unique = drafts.filter((d) => {
    if (seen.has(d.number)) return false;
    seen.add(d.number);
    return true;
  });
  if (unique.length !== drafts.length) {
    notes.push(`${drafts.length - unique.length} duplicate question number(s) across page boundaries were dropped.`);
  }

  unique.sort((a, b) => a.number - b.number);
  notes.unshift(`Read ${unique.length} question${unique.length === 1 ? "" : "s"} from ${pagesRead} page(s).`);
  if (result.stopped && lastPage) {
    notes.push(`Stopped at page ${lastPage}. Run the rest by setting the page range to start at ${lastPage + 1}.`);
  }

  return { drafts: unique, notes, stopped: result.stopped, pagesRead };
}

/** Internal signal to unwind out of the page loop without looking like a crash. */
class StopRun extends Error {
  constructor() {
    super("stopped");
    this.name = "StopRun";
  }
}
