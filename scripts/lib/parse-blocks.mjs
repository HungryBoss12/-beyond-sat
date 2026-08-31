const FIGURE_MARKER = "[FIGURE NEEDED — add an image URL for this question]";



/**
 * Turn the ordered text blocks a document reader produces into draft question
 * records.
 *
 * A *draft* is the same flat `Record<string, string>` the TSV and JSON paths
 * build, so `validateRecord` from `question-import.ts` gives document imports
 * byte-for-byte the same verdicts a pasted spreadsheet gets. Drafts stay
 * editable — the answer-key box and the per-row answer selector both write into
 * them — and validation re-runs from scratch on every change, so a row can never
 * hold a stale error.
 *
 * The rules here are read off real exam papers: a numbered paragraph opens a
 * question, the choices are the `A) B) C) D)` line (or four lines), the stem is
 * the paragraph immediately above the choices, and everything between the number
 * and the stem is the passage. That shape holds for the sample papers this was
 * written against, but not for every paper ever set — which is why nothing is
 * inserted without passing through the preview table first.
 */


  text;
  /** 1-based PDF page, when the block came from a paged document. */
  page?;
  /** Embedded images from DOCX — temporary until uploaded during import review. */
  images?;
};


  /** The number printed in the document. This is what an answer key refers to. */
  number;
  rec;
  /** Parse-time notes, merged into the row's warnings by the caller. */
  warnings;
  /** 1-based PDF page this question was read from, when known. */
  sourcePage?;
  /** Embedded DOCX images carried through review — never sent to the database. */
  sourceImages?;
  /** Staff confirmed the draft against the source page. */
  reviewed?;
};


  drafts;
  /** Blocks before the first numbered question — a cover page, usually. */
  preamble;
  /** Surfaced above the preview: how the document was read, and what was odd. */
  notes;
};


  section;
  skill;
  difficulty;
  source_month;
  source_year;
  module?;
};

export function blankDraft(defaults) {
  return {
    number,
    sourcePage,
    rec,
    warnings: [],
  };
}

export function draftModule(d) {
  return d.rec.module === "2" ? 2 ;
}

/**
 * Stamp each draft with module 1 or 2.
 *
 * Digital SAT papers restart numbering at the second module, so a drop from a
 * high number back to 1–5 is treated as the start of Module 2. Explicit
 * `rec.module` values already set by staff are left alone.
 */
export function stampDraftModules(drafts) {
  if (mode !== "both") {
    return drafts.map((d) => ({ ...d, rec }));
  }
  let current: 1 | 2 = 1;
  let prev = 0;
  const stamped = drafts.map((d, i) => {
    if (d.rec.module === "1" || d.rec.module === "2") {
      current = d.rec.module === "2" ? 2 ;
      prev = d.number;
      return d;
    }
    const blob = `${d.rec.prompt ?? ""}\n${d.rec.question_text ?? ""}`;
    if (/\bmodule\s*2\b/i.test(blob)) current = 2;
    if (i > 0 && d.number > 0 && prev >= 8 && d.number < prev && d.number <= 5) current = 2;
    prev = d.number;
    return { ...d, rec };
  });
  /* Numbering that never restarts (1…49 in a spreadsheet) still splits at the
     official SAT module size so one file can become two test sets. */
  const expected = drafts[0]?.rec.section === "math" ? 22 ;
  if (stamped.every((d) => draftModule(d) === 1) && stamped.length > expected) {
    return stamped.map((d, i) => ({
      ...d,
      rec,
    }));
  }
  return stamped;
}

/* `1.` / `1)` / `Question 1.` at the start of a block. The trailing `\s` is
   load-bearing: without it, a note line like "1926: Congress gave…" and a year
   like "2017" both read as question openers. */
const QUESTION_OPENER = /^\s*(?:question\s+)?(\d{1,3})\s*[.)]\s+/i;

/** A block that is itself one choice: `A) text`, `A. text`, `(A) text`. */
const CHOICE_OPENER = /^\s*\(?([A-H])\s*[).]\s+/;

function cellsFromMarkdownTable(block) {
  const cells: string[] = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*[-:]+/.test(trimmed)) continue;
    const parts = trimmed
      .split("|")
      .slice(1, -1)
      .map((c) => c.trim().replace(/\\\|/g, "|"));
    cells.push(...parts.filter(Boolean));
  }
  return cells;
}

/**
 * Math papers often lay out A–D inside a Word table. Those become markdown
 * table blocks, which the line-based choice scanner would miss.
 */
export function extractChoicesFromTableBlock(block)[] | null {
  if (!block.trimStart().startsWith("|")) return null;
  const cells = cellsFromMarkdownTable(block);
  if (cells.length < 2) return null;

  for (const cell of cells) {
    const inline = splitInlineChoices(cell);
    if (inline && inline.length >= 2) return inline;
  }

  const choices[] = [];
  for (const cell of cells) {
    const m = cell.match(CHOICE_OPENER);
    if (!m) continue;
    choices.push({ id(m[0].length).trim() });
  }
  const ordered = choices.every((c, idx) => c.id === String.fromCharCode(65 + idx));
  if (choices.length >= 2 && ordered && choices[0].id === "A" && choices.every((c) => c.text)) {
    return choices;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Choices
// ---------------------------------------------------------------------------

/**
 * Split a single line holding every choice — `A) contain  B) prepare  C) …`.
 *
 * Markers must appear in strict alphabetical order starting at A, and nothing
 * may precede the `A`. Both guards exist because a choice's own text can contain
 * a bracketed letter; requiring the sequence means a stray `(b)` mid-sentence
 * can't open a phantom choice.
 */
export function splitInlineChoices(line)[] | null {
  const marks[] = [];
  const re = /(^|[\s\u00A0])\(?([A-H])\s*[).]\s*/g;
  let m;
  while ((m = re.exec(line))) {
    if (m[2].charCodeAt(0) - 65 !== marks.length) continue;
    marks.push({ id+ m[1].length, textAt+ m[0].length });
  }
  if (marks.length < 2) return null;
  if (line.slice(0, marks[0].start).trim() !== "") return null;

  const out = marks.map((mark, i) => ({
    id(mark.textAt, marks[i + 1]?.start ?? line.length).trim(),
  }));
  return out.every((c) => c.text) ? out ;
}

/**
 * Locate the choice run inside a question's blocks.
 *
 * Two layouts, both common: every choice on one line, or one choice per line.
 *
 * The run is searched for *backwards from the end* rather than assumed to be the
 * last block, because real papers put things after the choices — "GO ON TO THE
 * NEXT PAGE", a page number, a footer. The June 2025 sample carries a stray
 * editorial line after question 20's choices, and treating it as the stem cost
 * that question both its choices and its skill. The search is capped at the last
 * 12 blocks so it can't reach back into the passage and read a sentence starting
 * "A " as choice A.
 */
function locateChoices(
  blocks)[]; start; end: number } | null {
  const floor = Math.max(1, blocks.length - 12);

  for (let i = blocks.length - 1; i >= floor; i--) {
    const tableChoices = extractChoicesFromTableBlock(blocks[i]);
    if (tableChoices) return { choices: tableChoices, start: i, end: i };

    const inline = splitInlineChoices(blocks[i]);
    if (inline) return { choices: inline, start: i, end: i };

    /* One choice per block. Walked backwards and required to terminate on a real
       `A)` marker, so a passage sentence opening with "A " can't be swept in. */
    const stack[] = [];
    for (let j = i; j >= 0; j--) {
      const m = blocks[j].match(CHOICE_OPENER);
      if (!m) break;
      stack.unshift({ id(m[0].length).trim() });
      if (m[1] === "A") break;
    }
    const ordered = stack.every((c, idx) => c.id === String.fromCharCode(65 + idx));
    if (stack.length >= 2 && ordered && stack[0].id === "A" && stack.every((c) => c.text)) {
      return { choices: stack, start: i - stack.length + 1, end: i };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Skill inference
// ---------------------------------------------------------------------------

/**
 * Guess a Reading & Writing skill from the stem's wording.
 *
 * Digital SAT stems are near-boilerplate — "most nearly means", "most logical
 * transition", "uses relevant information from the notes" — so matching on them
 * is reliable in a way that guessing a Math skill from prose is not. Math falls
 * back to the section default the admin picked, which is why the header has one.
 */
const RW_SKILL_HINTS: Array = [
  [/conform(?:s|ing)? to the conventions of standard english/i, "Standard English Conventions"],
  [/most logical transition/i, "Expression of Ideas"],
  [/uses relevant information from the notes|the student wants to/i, "Expression of Ideas"],
  [/most nearly mean|logical and precise word/i, "Craft and Structure"],
  [
    /main purpose|overall structure|structure of the text|function of the underlined/i,
    "Craft and Structure",
  ],
  [/would most likely (?:respond|say)|author of text \d|both texts/i, "Craft and Structure"],
  [
    /main idea|most strongly supports|best supports|would (?:most directly )?(?:weaken|undermine)|illustrat(?:e|es|ing) the claim|most logically completes|logically completes the text|best states the (?:claim|conclusion|hypothesis)|data (?:in|from) the (?:table|graph)/i,
    "Information and Ideas",
  ],
];

function inferSkill(
  stem) {
  if (section === "reading_writing") {
    for (const [re, skill] of RW_SKILL_HINTS) {
      if (re.test(stem)) return { skill, guessed: true };
    }
  }
  return { skill: fallback, guessed: false };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * Group blocks into questions on the numbered openers.
 *
 * The sequence guard — a number is only an opener if it continues the run — is
 * what keeps dated note lines ("1938…") and figures numbered
 * inside a passage from splitting a question in half. A gap of up to three is
 * tolerated and reported, because a genuinely missing question is more likely
 * than the numbering restarting.
 */
function asSourceBlocks(blocks) {
  return blocks.map((b) => (typeof b === "string" ? { text} ));
}

export function blocksToDrafts(
  blocks) {
  const notes: string[] = [];
  const groups[] = [];
  const preamble: string[] = [];
  let current | null = null;

  for (const block of asSourceBlocks(blocks)) {
    const m = block.text.match(QUESTION_OPENER);
    if (m) {
      const n = Number(m[1]);
      const expected = current ? current.number + 1 ;
      const opens = current ? n >= expected && n <= expected + 3 : n === 1 || n === expected;
      if (opens) {
        if (current) groups.push(current);
        if (current && n > expected) {
          notes.push(
            `Question numbering jumps from ${current.number} to ${n} — ${n - expected} question(s) may be missing.`,
          );
        }
        const rest = block.text.slice(m[0].length).trim();
        current = {
          number: n,
          page: block.page,
          blocks: rest ? [rest] : [],
          images: block.images ? [...block.images] : [],
        };
        continue;
      }
    }
    if (current) {
      current.blocks.push(block.text);
      if (block.images?.length) current.images.push(...block.images);
    } else preamble.push(block.text);
  }
  if (current) groups.push(current);

  if (groups.length === 0) {
    notes.push(
      'No numbered questions were found. Each question must start a new paragraph with its number, like "1. " or "1) ".',
    );
    return { drafts: [], preamble, notes };
  }

  const drafts = groups.map(({ number, page, blocks}) => {
    const warnings: string[] = [];
    const located = locateChoices(body);
    const choices = located?.choices ?? [];
    const remaining = located ? body.slice(0, located.start) ;
    const trailing = located ? body.slice(located.end + 1) ;

    /* The stem is the paragraph directly above the choices; everything above
       that is the passage, stimulus or note list. With no choices at all
       (grid-in) the last paragraph is the stem. */
    const stem = remaining[remaining.length - 1] ?? "";
    const prompt = remaining.slice(0, -1).join("\n\n");

    if (!stem) warnings.push("No question text could be read for this question.");
    if (choices.length === 0) {
      warnings.push(
        "No A/B/C/D choices were found — treated as a grid-in. Fix the row if it should be multiple choice.",
      );
    }
    if (trailing.length) {
      warnings.push(
        `Ignored ${trailing.length} paragraph(s) after the choices, starting "${trailing[0].slice(0, 50)}…".`,
      );
    }
    if ((prompt + stem).includes(FIGURE_MARKER)) {
      warnings.push(
        "This question has an image in the document. Add an image URL, or the question will be unanswerable.",
      );
    }

    const { skill, guessed } = inferSkill(stem, defaults.section, defaults.skill);
    if (guessed && skill !== defaults.skill) {
      warnings.push(`Skill read from the wording as "${skill}".`);
    }

    const rec = {
      section: defaults.section,
      skill,
      difficulty: defaults.difficulty,
      kind: choices.length > 0 ? "multiple_choice" : "grid_in",
      prompt,
      question_text: stem,
      correct: "",
      explanation: "",
      source_month: defaults.source_month,
      source_year: defaults.source_year,
    };
    for (const c of choices) rec[`choice_${c.id}`] = c.text;

    return { number, rec, warnings, sourcePage: page, sourceImages: images.length ? images : undefined };
  });

  const withChoices = drafts.filter((d) => d.rec.kind === "multiple_choice").length;
  notes.push(
    `Read ${drafts.length} question${drafts.length === 1 ? "" } — ${withChoices} multiple choice, ${drafts.length - withChoices} without choices.`,
  );
  if (preamble.length) {
    notes.push(
      `${preamble.length} paragraph(s) before question 1 were ignored (cover page or instructions).`,
    );
  }

  return { drafts, preamble, notes };
}
