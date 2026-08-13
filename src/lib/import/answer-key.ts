import { draftModule, type Draft } from "./parse";

/**
 * Parse a pasted answer key.
 *
 * Official keys are usually a letter run per module, not a flat 1. A / 2. D
 * list — and Module 2 restarts at 1, so a single numbered list is the wrong
 * shape for a whole paper. Section headers (`Section 1:`, `Module 2:`) split
 * the paste; each block is either numbered (`1. A`) or a run of answers
 * (`A D C B` / `ADCB`) applied in order to that module.
 */

export type AnswerEntry = {
  number: number;
  value: string;
  module?: 1 | 2;
};

export type AnswerKey = {
  entries: AnswerEntry[];
  unparsed: string[];
  /** True when the paste named Section/Module 1 and/or 2. */
  sectioned: boolean;
};

/* `12. B` and friends. The answer runs to the next question number or the end,
   so grid-in values with spaces or slashes ("3/4", "1.5") survive. */
const ENTRY =
  /(\d{1,3})\s*(?:[.):\]-]|\s)\s*([^\s][^\n]*?)(?=\s+\d{1,3}\s*(?:[.):\]-]|\s)\s*[^\s]|\s*$)/g;

const HEADER =
  /\b(?:(?:reading\s*(?:and|&)?\s*writing|math|rw)\s+)?(?:section|module|mod|part)\s*([12])\b\s*[:.\-)–—]?\s*/gi;

export function parseAnswerKey(text: string): AnswerKey {
  const src = text.replace(/\r\n?/g, "\n").trim();
  if (!src) return { entries: [], unparsed: [], sectioned: false };

  const sections = splitSections(src);
  if (!sections) {
    const chunk = parseChunk(src);
    return { entries: chunk.entries, unparsed: chunk.unparsed, sectioned: false };
  }

  const entries: AnswerEntry[] = [];
  const unparsed: string[] = [];
  for (const sec of sections) {
    const chunk = parseChunk(sec.body);
    for (const e of chunk.entries) entries.push({ ...e, module: sec.module });
    unparsed.push(...chunk.unparsed);
  }
  return { entries, unparsed, sectioned: true };
}

function splitSections(src: string): { module: 1 | 2; body: string }[] | null {
  const hits: { module: 1 | 2; headerStart: number; bodyStart: number }[] = [];
  HEADER.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = HEADER.exec(src))) {
    hits.push({
      module: Number(m[1]) === 2 ? 2 : 1,
      headerStart: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  if (hits.length === 0) return null;

  const sections: { module: 1 | 2; body: string }[] = [];
  const pre = src.slice(0, hits[0].headerStart).trim();
  if (pre) sections.push({ module: 1, body: pre });
  for (let i = 0; i < hits.length; i++) {
    const end = i + 1 < hits.length ? hits[i + 1].headerStart : src.length;
    sections.push({ module: hits[i].module, body: src.slice(hits[i].bodyStart, end).trim() });
  }
  return sections;
}

function parseChunk(body: string): { entries: AnswerEntry[]; unparsed: string[] } {
  const numbered = parseNumbered(body);
  if (numbered.entries.length > 0) return numbered;
  const tokens = parseBareAnswers(body);
  if (tokens.length > 0) {
    return {
      entries: tokens.map((value, i) => ({ number: i + 1, value })),
      unparsed: [],
    };
  }
  return {
    entries: [],
    unparsed: body ? [body.length > 60 ? body.slice(0, 60) + "…" : body] : [],
  };
}

function parseNumbered(text: string): { entries: AnswerEntry[]; unparsed: string[] } {
  const entries: AnswerEntry[] = [];
  const unparsed: string[] = [];
  const src = text.trim();
  if (!src) return { entries, unparsed };

  const lines = src
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const perLine = lines.every((l) => /^\s*\(?\d{1,3}\)?\s*[.):\]-]?\s+\S/.test(l));

  const scan = (chunk: string) => {
    ENTRY.lastIndex = 0;
    let hit = false;
    let m: RegExpExecArray | null;
    while ((m = ENTRY.exec(chunk))) {
      const n = Number(m[1]);
      const value = m[2].trim().replace(/[.,;]+$/, "");
      if (!Number.isFinite(n) || n < 1 || n > 999 || !value) continue;
      hit = true;
      entries.push({ number: n, value });
    }
    if (!hit) unparsed.push(chunk.length > 60 ? chunk.slice(0, 60) + "…" : chunk);
  };

  if (perLine) lines.forEach(scan);
  else scan(src.replace(/\n/g, " "));

  return { entries, unparsed };
}

/** `A D C B`, `A, D, C`, or a packed `ADCB` run — one answer per question in order. */
function parseBareAnswers(body: string): string[] {
  const cleaned = body.replace(/^(?:answers?|key)\s*[:.\-–—]?\s*/i, "").trim();
  if (!cleaned) return [];
  const parts = cleaned.split(/[\s,;]+/).filter(Boolean);
  const out: string[] = [];
  for (const raw of parts) {
    const p = raw.replace(/^[[(]+/, "").replace(/[\]) .;]+$/, "");
    if (!p) continue;
    if (/^[A-Ha-h]$/.test(p)) {
      out.push(p.toUpperCase());
      continue;
    }
    if (/^[A-Ha-h]{2,40}$/.test(p)) {
      out.push(...p.toUpperCase().split(""));
      continue;
    }
    if (/^-?\d+(?:\.\d+)?(?:\/\d+)?$/.test(p) || /^-?\d+\/\d+$/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

/**
 * Write a key onto drafts.
 *
 * Sectioned keys match inside that module only, so both modules can restart at
 * question 1. A letter run is treated as Q1, Q2, Q3… of that section.
 */
export function applyAnswerKey(
  drafts: Draft[],
  key: AnswerKey,
): { drafts: Draft[]; filled: number; unmatched: number[] } {
  const used = new Set<number>();
  let filled = 0;

  const next = drafts.map((d) => {
    const mod = draftModule(d);
    const idx = key.entries.findIndex(
      (e, i) => !used.has(i) && e.number === d.number && (e.module == null || e.module === mod),
    );
    if (idx === -1) return d;
    used.add(idx);
    filled++;
    return { ...d, rec: { ...d.rec, correct: key.entries[idx].value } };
  });

  const unmatched = key.entries
    .filter((_, i) => !used.has(i))
    .map((e) => e.number)
    .filter((n, i, all) => all.indexOf(n) === i)
    .sort((a, b) => a - b);

  return { drafts: next, filled, unmatched };
}

/** Human summary of what a key did, for the line under the paste box. */
export function describeKey(
  key: AnswerKey,
  filled: number,
  drafts: Draft[],
  unmatched: number[],
): string {
  const total = drafts.length;
  if (key.sectioned) {
    const parts: string[] = [];
    for (const mod of [1, 2] as const) {
      const inMod = drafts.filter((d) => draftModule(d) === mod).length;
      const got = key.entries.filter((e) => e.module === mod).length;
      if (inMod === 0 && got === 0) continue;
      parts.push(`Section ${mod}: ${Math.min(got, inMod)} of ${inMod}`);
    }
    const head = `Filled ${filled} of ${total} question${total === 1 ? "" : "s"}`;
    return [
      head + (parts.length ? ` (${parts.join("; ")})` : "."),
      unmatchedLine(unmatched),
      unparsedLine(key),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const parts = [`Filled ${filled} of ${total} question${total === 1 ? "" : "s"}.`];
  const extra = unmatchedLine(unmatched);
  if (extra) parts.push(extra);
  const unread = unparsedLine(key);
  if (unread) parts.push(unread);
  return parts.join(" ");
}

function unmatchedLine(unmatched: number[]): string | null {
  if (!unmatched.length) return null;
  const shown = unmatched.slice(0, 8).join(", ");
  return `No question numbered ${shown}${unmatched.length > 8 ? ` (+${unmatched.length - 8} more)` : ""} in this document.`;
}

function unparsedLine(key: AnswerKey): string | null {
  if (!key.unparsed.length) return null;
  return `Couldn't read: ${key.unparsed
    .slice(0, 3)
    .map((u) => `"${u}"`)
    .join(", ")}.`;
}
