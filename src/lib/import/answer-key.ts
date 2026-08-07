import type { Draft } from "./parse";

/**
 * Parse a pasted answer key.
 *
 * Neither sample paper carried its answers in the document, and that is the
 * normal case — keys live in a separate PDF, a forum post, or a teacher's notes.
 * Without this, every document import produces rows that `validateRecord`
 * rejects for "No correct answer given", which is a wall, not a workflow.
 *
 * Deliberately permissive about shape, strict about numbering: `1. A`, `1) A`,
 * `1-A`, `1: A`, `1 A` and a bare run of letters all parse, but a question
 * number is never inferred — an answer that lands on the wrong question is worse
 * than one that doesn't land at all, because nothing about it looks wrong.
 */

export type AnswerKey = {
  /** question number → answer, as written (a letter, or a grid-in value). */
  answers: Map<number, string>;
  /** Fragments that looked like an entry but couldn't be read. */
  unparsed: string[];
};

/* `12. B` and friends. The answer runs to the next question number or the end,
   so grid-in values with spaces or slashes ("3/4", "1.5") survive. */
const ENTRY = /(\d{1,3})\s*(?:[.):\]-]|\s)\s*([^\s][^\n]*?)(?=\s+\d{1,3}\s*(?:[.):\]-]|\s)\s*[^\s]|\s*$)/g;

export function parseAnswerKey(text: string): AnswerKey {
  const answers = new Map<number, string>();
  const unparsed: string[] = [];
  const src = text.replace(/\r\n?/g, "\n").trim();
  if (!src) return { answers, unparsed };

  /* Line-oriented first: one entry per line is the common case and parsing it
     line by line means a stray word on one line can't swallow the next. */
  const lines = src.split("\n").map((l) => l.trim()).filter(Boolean);
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
      /* First write wins. A key pasted twice — or a key followed by a rationale
         that repeats the numbers — should not have its second copy overwrite a
         correct first one silently. */
      if (!answers.has(n)) answers.set(n, value);
    }
    if (!hit) unparsed.push(chunk.length > 60 ? chunk.slice(0, 60) + "…" : chunk);
  };

  if (perLine) lines.forEach(scan);
  else scan(src.replace(/\n/g, " "));

  return { answers, unparsed };
}

/**
 * Write a key onto drafts, matching on the number printed in the document.
 *
 * Returns counts rather than throwing on a mismatch: a key that covers 25 of 27
 * questions is still worth applying, and the two it missed are exactly what the
 * per-row selector is for.
 */
export function applyAnswerKey(
  drafts: Draft[],
  key: AnswerKey,
): { drafts: Draft[]; filled: number; unmatched: number[] } {
  const numbers = new Set(drafts.map((d) => d.number));
  const unmatched = [...key.answers.keys()].filter((n) => !numbers.has(n)).sort((a, b) => a - b);
  let filled = 0;

  const next = drafts.map((d) => {
    const value = key.answers.get(d.number);
    if (value == null) return d;
    filled++;
    return { ...d, rec: { ...d.rec, correct: value } };
  });

  return { drafts: next, filled, unmatched };
}

/** Human summary of what a key did, for the line under the paste box. */
export function describeKey(key: AnswerKey, filled: number, total: number, unmatched: number[]): string {
  const parts = [`Filled ${filled} of ${total} question${total === 1 ? "" : "s"}.`];
  if (unmatched.length) {
    const shown = unmatched.slice(0, 8).join(", ");
    parts.push(
      `No question numbered ${shown}${unmatched.length > 8 ? ` (+${unmatched.length - 8} more)` : ""} in this document.`,
    );
  }
  if (key.unparsed.length) {
    parts.push(`Couldn't read: ${key.unparsed.slice(0, 3).map((u) => `"${u}"`).join(", ")}.`);
  }
  return parts.join(" ");
}
