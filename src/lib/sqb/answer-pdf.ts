/**
 * Parse SQB answer-export PDF text (e.g. CirclesA.pdf).
 * Each page typically has Question ID + Correct Answer (+ Rationale).
 */
import type { Draft } from "@/lib/import/parse";
import type { SourceBlock } from "@/lib/import/parse";

export type SqbAnswerEntry = {
  externalId: string;
  correct: string;
  explanation: string;
};

export type SqbAnswerParseResult = {
  byExternalId: Map<string, SqbAnswerEntry>;
  ordered: SqbAnswerEntry[];
};

function joinLines(text: string): string {
  return text.replace(/\r\n?/g, "\n").trim();
}

function extractQuestionId(text: string): string {
  const m =
    text.match(/Question\s*ID\s*([A-Za-z0-9_-]+)/i) ||
    text.match(/\bID:\s*([A-Za-z0-9_-]+)/i);
  return m?.[1]?.trim() ?? "";
}

function extractCorrect(text: string): string {
  const m = text.match(/Correct\s*Answer\s*:\s*([^\n]+)/i);
  if (!m) return "";
  let raw = m[1].replace(/\s+/g, " ").trim();
  // Stop at trailing rationale noise if the line ran on
  raw = raw.replace(/\s+(Rationale|Choice|Explanation)\b.*$/i, "").trim();
  if (/^[A-D]$/i.test(raw)) return raw.toUpperCase();
  // Grid-in / numeric
  return raw.replace(/^\$+|\$+$/g, "").trim();
}

function extractRationale(text: string): string {
  const m = text.match(/\bRationale\b\s*([\s\S]*?)(?=\n\s*Question\s*ID\b|$)/i);
  if (!m) return "";
  return m[1].replace(/\s+/g, " ").trim();
}

function parseOneAnswerPage(raw: string): SqbAnswerEntry | null {
  const text = joinLines(raw);
  if (!text) return null;
  const correct = extractCorrect(text);
  if (!correct) return null;
  const externalId = extractQuestionId(text);
  const explanation = extractRationale(text);
  return { externalId, correct, explanation };
}

/**
 * Convert answer-PDF text blocks (one page ≈ one item) into a lookup by Question ID.
 */
export function parseSqbAnswerPages(
  blocks: Array<string | SourceBlock>,
): SqbAnswerParseResult {
  const byExternalId = new Map<string, SqbAnswerEntry>();
  const ordered: SqbAnswerEntry[] = [];

  for (const b of blocks) {
    const text = typeof b === "string" ? b : b.text;
    const entry = parseOneAnswerPage(text);
    if (!entry) continue;
    ordered.push(entry);
    if (entry.externalId) {
      byExternalId.set(entry.externalId.toLowerCase(), entry);
    }
  }

  return { byExternalId, ordered };
}

export const SQB_ANSWERS_JSON_TEMPLATE = `[
  {
    "external_id": "demo01ab",
    "correct": "C",
    "explanation": "Optional rationale — fills explanation when blank."
  },
  {
    "external_id": "demo02cd",
    "correct": "B"
  },
  {
    "correct": "3/4"
  }
]`;

function normalizeCorrect(raw: unknown): string {
  if (raw == null) return "";
  if (Array.isArray(raw)) {
    return raw
      .map((v) => String(v).trim())
      .filter(Boolean)
      .join(", ");
  }
  const s = String(raw).trim();
  if (/^[A-D]$/i.test(s)) return s.toUpperCase();
  return s;
}

function pickId(obj: Record<string, unknown>): string {
  const keys = ["external_id", "question_id", "sqb_id", "id"];
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

/**
 * Parse answers JSON: array or `{ "answers": [...] }`.
 * Each item: external_id (optional), correct, explanation (optional).
 */
export function parseSqbAnswersJson(text: string): {
  parsed: SqbAnswerParseResult;
  error: string | null;
} {
  const empty: SqbAnswerParseResult = {
    byExternalId: new Map(),
    ordered: [],
  };
  const trimmed = text.trim();
  if (!trimmed) {
    return { parsed: empty, error: "Paste an answers JSON array." };
  }
  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { parsed: empty, error: "Answers JSON is not valid JSON." };
  }
  let rows: unknown[] = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (data && typeof data === "object" && Array.isArray((data as { answers?: unknown }).answers)) {
    rows = (data as { answers: unknown[] }).answers;
  } else {
    return {
      parsed: empty,
      error: 'Expected an array, or an object with an "answers" array.',
    };
  }

  const byExternalId = new Map<string, SqbAnswerEntry>();
  const ordered: SqbAnswerEntry[] = [];
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const obj = row as Record<string, unknown>;
    const correct = normalizeCorrect(obj.correct ?? obj.answer);
    if (!correct) continue;
    const externalId = pickId(obj);
    const explanation =
      typeof obj.explanation === "string"
        ? obj.explanation.trim()
        : typeof obj.rationale === "string"
          ? obj.rationale.trim()
          : "";
    const entry: SqbAnswerEntry = { externalId, correct, explanation };
    ordered.push(entry);
    if (externalId) {
      byExternalId.set(externalId.toLowerCase(), entry);
    }
  }
  if (ordered.length === 0) {
    return {
      parsed: empty,
      error: "No answer rows with a usable correct value.",
    };
  }
  return { parsed: { byExternalId, ordered }, error: null };
}

export type ApplySqbAnswersResult = {
  drafts: Draft[];
  matched: number;
  unmatched: number;
  byOrder: number;
};

/**
 * Stamp `correct` (and empty `explanation`) from answer PDF onto question drafts.
 * Prefer Question ID → external_id; fall back to pack order for remaining drafts.
 */
export function applySqbAnswers(
  drafts: Draft[],
  parsed: SqbAnswerParseResult,
): ApplySqbAnswersResult {
  let matched = 0;
  let byOrder = 0;
  const usedOrdered = new Set<number>();

  const withIds = drafts.map((d) => {
    const eid = (d.rec.external_id ?? "").trim().toLowerCase();
    if (!eid) return { draft: d, entry: null as SqbAnswerEntry | null };
    const entry = parsed.byExternalId.get(eid) ?? null;
    if (entry) {
      matched += 1;
      const oi = parsed.ordered.findIndex(
        (e) => e.externalId.trim().toLowerCase() === eid && e.correct === entry.correct,
      );
      if (oi >= 0) usedOrdered.add(oi);
    }
    return { draft: d, entry };
  });

  let orderCursor = 0;
  const next = withIds.map(({ draft: d, entry }) => {
    let use = entry;
    if (!use) {
      while (orderCursor < parsed.ordered.length && usedOrdered.has(orderCursor)) {
        orderCursor += 1;
      }
      if (orderCursor < parsed.ordered.length) {
        use = parsed.ordered[orderCursor];
        usedOrdered.add(orderCursor);
        orderCursor += 1;
        byOrder += 1;
      }
    }
    if (!use) return d;

    const correct = use.correct;
    const explanation =
      (d.rec.explanation ?? "").trim() || use.explanation || d.rec.explanation || "";
    const isLetter = /^[A-D]$/i.test(correct);

    return {
      ...d,
      rec: {
        ...d.rec,
        correct,
        explanation,
        kind: isLetter
          ? d.rec.kind === "grid_in"
            ? "grid_in"
            : "multiple_choice"
          : "grid_in",
      },
    };
  });

  const unmatched = Math.max(0, drafts.length - matched - byOrder);
  return { drafts: next, matched, unmatched, byOrder };
}

export function describeSqbAnswerApply(r: ApplySqbAnswersResult, totalAnswers: number): string {
  const parts = [`Matched ${r.matched}/${r.drafts.length} answers by Question ID`];
  if (r.byOrder > 0) parts.push(`${r.byOrder} by order`);
  if (r.unmatched > 0) parts.push(`${r.unmatched} question(s) still without an answer`);
  if (totalAnswers > r.matched + r.byOrder) {
    parts.push(`${totalAnswers - r.matched - r.byOrder} answer(s) unused`);
  }
  return parts.join(" · ") + ".";
}
