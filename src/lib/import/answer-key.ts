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
  /**
   * The paste carried no question numbers, so `number` is this answer's place in
   * the run rather than a printed question number.
   */
  positional?: boolean;
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

/**
 * Numbering written with punctuation — `1.`, `2)`, `(3)`, `4:`, `5 - `.
 *
 * A grid-in answer can't match: the dot only counts as numbering when a space or
 * a choice letter follows it, so `0.75` and `3/4` are never read as "question 0"
 * or "question 3".
 */
const NUMBER_MARK = /(?:^|[\s,;])\(?\d{1,3}(?:\)|\]|:|\s*[-–—]|\.(?=\s|[A-Ha-h](?![\w./])))/;

/** A grid-in value: `12`, `-4`, `0.75`, `.5`, `3/4`. */
const BARE_NUMBER = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:\/\d+)?$/;

/**
 * Does this block carry question numbers, or is it a bare run of answers?
 *
 * Worth asking before parsing, because the two shapes collide: in a run that
 * holds open answers (`B 15 A 3/4`) every digit also reads as a question number,
 * and whichever parser runs first wins. Punctuation settles it outright;
 * otherwise a block only counts as numbered when every other token is a number
 * *and* those numbers count up by one, which a run of grid-ins won't do.
 */
function looksNumbered(body: string): boolean {
  if (NUMBER_MARK.test(body)) return true;

  const tokens = body.split(/[\s,;]+/).filter(Boolean);
  if (tokens.length < 4 || tokens.length % 2 !== 0) return false;

  const numbers: number[] = [];
  for (let i = 0; i < tokens.length; i += 2) {
    if (!/^\d{1,3}$/.test(tokens[i])) return false;
    numbers.push(Number(tokens[i]));
  }
  return numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
}

function truncate(s: string): string {
  return s.length > 60 ? s.slice(0, 60) + "…" : s;
}

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
  if (looksNumbered(body)) {
    const numbered = parseNumbered(body);
    if (numbered.entries.length > 0) return numbered;
  }

  const bare = parseBareAnswers(body);
  if (bare.values.length > 0) {
    return {
      entries: bare.values.map((value, i) => ({ number: i + 1, value, positional: true })),
      unparsed: bare.unparsed,
    };
  }

  const numbered = parseNumbered(body);
  if (numbered.entries.length > 0) return numbered;
  return { entries: [], unparsed: body ? [truncate(body)] : [] };
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
    if (!hit) unparsed.push(truncate(chunk));
  };

  if (perLine) lines.forEach(scan);
  else scan(src.replace(/\n/g, " "));

  return { entries, unparsed };
}

/**
 * `A D C B`, `A, D, C`, a packed `ADCB` run, or a mixed run holding grid-ins
 * (`B 15 A 3/4`) — one answer per question, in order.
 *
 * A token nobody can read is reported rather than dropped: skipping it silently
 * would shift every later answer onto the wrong question.
 */
function parseBareAnswers(body: string): { values: string[]; unparsed: string[] } {
  const cleaned = body
    .replace(/^(?:answers?|key)\s*[:.\-–—]?\s*/i, "")
    /* `3 / 4` is one grid-in answer, not two. */
    .replace(/(\d)\s*\/\s*(\d)/g, "$1/$2")
    .trim();
  if (!cleaned) return { values: [], unparsed: [] };

  const values: string[] = [];
  const unparsed: string[] = [];
  for (const raw of cleaned.split(/[\s,;]+/).filter(Boolean)) {
    const p = raw.replace(/^[[($]+/, "").replace(/[\])$.;]+$/, "");
    if (!p) continue;
    if (/^[A-Ha-h]$/.test(p)) {
      values.push(p.toUpperCase());
      continue;
    }
    if (/^[A-Ha-h]{2,40}$/.test(p)) {
      values.push(...p.toUpperCase().split(""));
      continue;
    }
    if (BARE_NUMBER.test(p)) {
      values.push(p);
      continue;
    }
    unparsed.push(truncate(p));
  }
  return { values, unparsed };
}

/**
 * Write a key onto drafts.
 *
 * Sectioned keys match inside that module only, so both modules can restart at
 * question 1. A run with no numbers is applied by position instead: the nth
 * answer fills that module's nth question, whatever number is printed on it, so
 * a paper whose numbering starts at 12 still takes a pasted run.
 */
export function applyAnswerKey(
  drafts: Draft[],
  key: AnswerKey,
): { drafts: Draft[]; filled: number; unmatched: number[]; extra: number } {
  const used = new Set<number>();
  const values = new Map<number, string>();

  key.entries.forEach((entry, i) => {
    if (entry.positional) return;
    const target = drafts.findIndex(
      (d, idx) =>
        !values.has(idx) &&
        d.number === entry.number &&
        (entry.module == null || entry.module === draftModule(d)),
    );
    if (target === -1) return;
    used.add(i);
    values.set(target, entry.value);
  });

  const runs = new Map<string, number[]>();
  key.entries.forEach((entry, i) => {
    if (!entry.positional) return;
    const bucket = entry.module == null ? "any" : String(entry.module);
    const list = runs.get(bucket);
    if (list) list.push(i);
    else runs.set(bucket, [i]);
  });

  for (const [bucket, indexes] of runs) {
    const targets = drafts
      .map((d, idx) => ({ d, idx }))
      .filter(
        ({ d, idx }) => !values.has(idx) && (bucket === "any" || draftModule(d) === Number(bucket)),
      )
      .map(({ idx }) => idx);
    indexes.forEach((entry, position) => {
      const target = targets[position];
      if (target == null) return;
      used.add(entry);
      values.set(target, key.entries[entry].value);
    });
  }

  const next = drafts.map((d, i) => {
    const value = values.get(i);
    return value == null ? d : { ...d, rec: { ...d.rec, correct: value } };
  });

  const leftover = key.entries.filter((_, i) => !used.has(i));
  const unmatched = leftover
    .filter((e) => !e.positional)
    .map((e) => e.number)
    .filter((n, i, all) => all.indexOf(n) === i)
    .sort((a, b) => a - b);

  return {
    drafts: next,
    filled: values.size,
    unmatched,
    extra: leftover.filter((e) => e.positional).length,
  };
}

/** Human summary of what a key did, for the line under the paste box. */
export function describeKey(
  key: AnswerKey,
  filled: number,
  drafts: Draft[],
  unmatched: number[],
  extra = 0,
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
      extraLine(extra),
      unparsedLine(key),
    ]
      .filter(Boolean)
      .join(" ");
  }

  const parts = [`Filled ${filled} of ${total} question${total === 1 ? "" : "s"}.`];
  const missing = unmatchedLine(unmatched);
  if (missing) parts.push(missing);
  const over = extraLine(extra);
  if (over) parts.push(over);
  const unread = unparsedLine(key);
  if (unread) parts.push(unread);
  return parts.join(" ");
}

function extraLine(extra: number): string | null {
  if (extra <= 0) return null;
  return `${extra} answer${extra === 1 ? "" : "s"} at the end had no question left to fill.`;
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
