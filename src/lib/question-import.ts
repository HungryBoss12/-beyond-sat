import { LETTER_DIFFICULTIES, MONTHS, skillsFor, type Difficulty, type Section } from "@/lib/sat";

/**
 * Bulk question import: parsing and validation.
 *
 * Two entry points — `parseDelimited` for spreadsheet paste and `parseJson` for
 * an LLM-produced array — both returning the same `RowResult[]` so the import
 * screen has one preview table and one insert path.
 *
 * Everything here is pure. No Supabase, no React: the component decides what to
 * do with the verdicts.
 */

export type QuestionKind = "multiple_choice" | "grid_in";

/** A validated row, shaped for insertion into `public.questions`. */
export type ParsedQuestion = {
  section: Section;
  skill: string;
  difficulty: Difficulty;
  kind: QuestionKind;
  prompt: string | null;
  question_text: string;
  choices: { id: string; text: string }[];
  correct_choice_id: string | null;
  correct_grid_answers: string[] | null;
  explanation: string | null;
  image_url: string | null;
  source_month: number | null;
  source_year: number | null;
  time_limit_seconds: number | null;
};

export type RowResult = {
  /** 1-based, counting data rows only — matches what the preview table shows. */
  index: number;
  question: ParsedQuestion | null;
  /** Blocking. A row with any error is not imported. */
  errors: string[];
  /** Non-blocking; the row still imports. */
  warnings: string[];
  /** Set by `flagDuplicates`: repeats this batch, or already in the bank. */
  duplicate?: boolean;
};

export type ParseResult = {
  rows: RowResult[];
  /** Set when nothing could be parsed at all (bad JSON, missing header row). */
  fatal: string | null;
  /** Headers we didn't recognise, surfaced so a typo'd column isn't silent. */
  ignoredColumns: string[];
};

const CHOICE_IDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

const MAX_ROWS = 1000;

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

/** Lowercase, collapse anything non-alphanumeric to a single underscore. */
function normKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normValue(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

/** Canonical field name for a header cell, or null if unrecognised. */
function canonicalField(header: string): string | null {
  const k = normKey(header);
  const direct: Record<string, string> = {
    section: "section",
    module: "section",
    subject: "section",
    skill: "skill",
    domain: "skill",
    topic: "skill",
    category: "skill",
    difficulty: "difficulty",
    diff: "difficulty",
    level: "difficulty",
    kind: "kind",
    type: "kind",
    format: "kind",
    prompt: "prompt",
    passage: "prompt",
    stimulus: "prompt",
    context: "prompt",
    question_text: "question_text",
    question: "question_text",
    text: "question_text",
    stem: "question_text",
    correct: "correct",
    answer: "correct",
    correct_answer: "correct",
    correct_choice: "correct",
    correct_choice_id: "correct",
    key: "correct",
    answers: "correct",
    accepted_answers: "correct",
    correct_grid_answers: "correct",
    explanation: "explanation",
    rationale: "explanation",
    solution: "explanation",
    why: "explanation",
    image_url: "image_url",
    image: "image_url",
    img: "image_url",
    picture: "image_url",
    source_month: "source_month",
    month: "source_month",
    source_year: "source_year",
    year: "source_year",
    time_limit_seconds: "time_limit_seconds",
    time_limit_sec: "time_limit_seconds",
    seconds: "time_limit_seconds",
    time_limit_minutes: "time_limit_minutes",
    time_limit_min: "time_limit_minutes",
    time_limit: "time_limit_minutes",
    minutes: "time_limit_minutes",
  };
  if (direct[k]) return direct[k];

  /* Choice columns: A / a / choice_a / option_a / answer_a / choice_1 … */
  const m = k.match(/^(?:choice|option|answer|ans|opt)?_?([a-h1-8])$/);
  if (m) {
    const c = m[1];
    const idx = /[1-8]/.test(c) ? Number(c) - 1 : c.toUpperCase().charCodeAt(0) - 65;
    if (idx >= 0 && idx < CHOICE_IDS.length) return `choice_${CHOICE_IDS[idx]}`;
  }
  return null;
}

function parseSection(raw: string): Section | null {
  const v = normValue(raw);
  if (!v) return null;
  if (["math", "maths", "m", "mathematics"].includes(v)) return "math";
  if (
    [
      "readingwriting",
      "rw",
      "readingandwriting",
      "english",
      "reading",
      "verbal",
      "eng",
      "readingwritingandlanguage",
    ].includes(v)
  ) {
    return "reading_writing";
  }
  return null;
}

function parseDifficulty(raw: string): Difficulty | null {
  const v = normValue(raw);
  if (!v) return null;
  /* The enum accepts easy/medium/hard as well as the letters, but the admin UI
     only ever writes letters. Fold the words onto letters so a mixed import
     doesn't produce two spellings of the same difficulty — this mirrors
     `difficultyLabel` in lib/sat. */
  const words: Record<string, Difficulty> = { easy: "C", medium: "B", hard: "A" };
  if (words[v]) return words[v];
  const upper = v.toUpperCase();
  if ((LETTER_DIFFICULTIES as readonly string[]).includes(upper)) return upper as Difficulty;
  return null;
}

function parseKind(raw: string): QuestionKind | null {
  const v = normValue(raw);
  if (!v) return null;
  if (["multiplechoice", "mc", "mcq", "choice", "multiple", "select"].includes(v)) {
    return "multiple_choice";
  }
  if (
    ["gridin", "grid", "spr", "sr", "studentresponse", "freeresponse", "fr", "numeric"].includes(v)
  ) {
    return "grid_in";
  }
  return null;
}

function parseMonth(raw: string): number | "invalid" | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^\d+$/.test(t)) {
    const n = Number(t);
    return n >= 1 && n <= 12 ? n : "invalid";
  }
  const v = normValue(t);
  const i = MONTHS.findIndex((m) => normValue(m) === v || normValue(m).startsWith(v));
  return i === -1 ? "invalid" : i + 1;
}

/** Case-insensitive match against the section's skill list. */
function matchSkill(raw: string, section: Section): string | null {
  const list = skillsFor(section);
  const v = normValue(raw);
  if (!v) return null;
  const exact = list.find((s) => normValue(s) === v);
  if (exact) return exact;
  /* Fall back to a prefix/substring hit so "Algebra " or "Geometry" land on the
     right skill without demanding the full official label. */
  const loose = list.find((s) => normValue(s).startsWith(v) || v.startsWith(normValue(s)));
  return loose ?? null;
}

function splitAnswers(raw: string): string[] {
  return raw
    .split(/[,;|]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Delimited text (TSV / CSV)
// ---------------------------------------------------------------------------

/**
 * Split delimited text into rows of cells, honouring the clipboard quoting
 * convention: a cell wrapped in `"` may contain the delimiter, newlines, and
 * `""` for a literal quote. Sheets and Excel both quote this way when a cell
 * holds a line break, which is exactly what a Reading & Writing passage does.
 */
export function splitDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let i = 0;
  const src = text.replace(/\r\n?/g, "\n");

  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === "") {
      quoted = true;
      i++;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    cell += ch;
    i++;
  }
  row.push(cell);
  rows.push(row);

  /* Drop trailing blank lines — a paste almost always ends with one. */
  while (rows.length && rows[rows.length - 1].every((c) => c.trim() === "")) rows.pop();
  return rows;
}

export function parseDelimited(text: string): ParseResult {
  const empty: ParseResult = { rows: [], fatal: null, ignoredColumns: [] };
  if (!text.trim()) return { ...empty, fatal: "Nothing pasted yet." };

  const firstLine = text.replace(/\r\n?/g, "\n").split("\n")[0] ?? "";
  const delimiter = firstLine.includes("\t") ? "\t" : ",";
  const grid = splitDelimited(text, delimiter);
  if (grid.length === 0) return { ...empty, fatal: "Nothing pasted yet." };

  const headerCells = grid[0];
  const fields = headerCells.map(canonicalField);
  const ignoredColumns = headerCells
    .filter((h, i) => fields[i] === null && h.trim() !== "")
    .map((h) => h.trim());

  if (!fields.includes("question_text")) {
    return {
      ...empty,
      ignoredColumns,
      fatal:
        "The first row must be a header row, and one column must be the question itself " +
        '(a column named "question_text", "question" or "text"). ' +
        `Found: ${headerCells.map((h) => h.trim() || "(blank)").join(" | ")}`,
    };
  }

  const dataRows = grid.slice(1).filter((r) => r.some((c) => c.trim() !== ""));
  if (dataRows.length === 0) {
    return { ...empty, ignoredColumns, fatal: "Found a header row but no data rows under it." };
  }
  if (dataRows.length > MAX_ROWS) {
    return {
      ...empty,
      ignoredColumns,
      fatal: `That's ${dataRows.length} rows — the limit is ${MAX_ROWS} per import. Split it into smaller batches.`,
    };
  }

  const rows = dataRows.map((cells, i) => {
    const rec: Record<string, string> = {};
    fields.forEach((f, ci) => {
      if (!f) return;
      const v = cells[ci];
      if (v == null) return;
      /* Two columns can map to the same field (e.g. "answer" and "key"); first
         non-empty wins rather than the last one silently overwriting. */
      if (rec[f] == null || rec[f].trim() === "") rec[f] = v;
    });
    return validateRecord(rec, i + 1);
  });

  return { rows, fatal: null, ignoredColumns };
}

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

/** Flatten a JSON question object into the same string record the TSV path builds. */
function jsonToRecord(item: unknown): { rec: Record<string, string>; unknown: string[] } {
  const rec: Record<string, string> = {};
  const unknown: string[] = [];
  const str = (v: unknown): string => {
    if (v == null) return "";
    if (Array.isArray(v)) return v.join(", ");
    if (typeof v === "object") return "";
    return String(v);
  };

  if (!item || typeof item !== "object" || Array.isArray(item)) {
    return { rec, unknown };
  }

  for (const [rawKey, value] of Object.entries(item)) {
    const field = canonicalField(rawKey);

    /* `choices` is the one field that isn't a scalar, and LLMs emit it three
       different ways: ["3","5"], [{id,text}], or {A:"3",B:"5"}. Accept all. */
    if (field === null && normKey(rawKey) === "choices") {
      if (Array.isArray(value)) {
        value.forEach((c: unknown, i) => {
          if (i >= CHOICE_IDS.length) return;
          if (c && typeof c === "object" && !Array.isArray(c)) {
            const choice = c as Record<string, unknown>;
            const id = String(choice.id ?? choice.label ?? CHOICE_IDS[i])
              .trim()
              .toUpperCase();
            const slot = (CHOICE_IDS as readonly string[]).includes(id) ? id : CHOICE_IDS[i];
            rec[`choice_${slot}`] = str(choice.text ?? choice.value ?? choice.content);
          } else {
            rec[`choice_${CHOICE_IDS[i]}`] = str(c);
          }
        });
      } else if (value && typeof value === "object") {
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
          const id = normValue(k).toUpperCase();
          if ((CHOICE_IDS as readonly string[]).includes(id)) rec[`choice_${id}`] = str(v);
        }
      }
      continue;
    }

    if (field === null) {
      if (rawKey.trim()) unknown.push(rawKey.trim());
      continue;
    }
    if (rec[field] == null || rec[field].trim() === "") rec[field] = str(value);
  }
  return { rec, unknown };
}

export function parseJson(text: string): ParseResult {
  const empty: ParseResult = { rows: [], fatal: null, ignoredColumns: [] };
  if (!text.trim()) return { ...empty, fatal: "Nothing pasted yet." };

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e: unknown) {
    return {
      ...empty,
      fatal: `That isn't valid JSON — ${e instanceof Error ? e.message : "parse failed"}. A common cause is a trailing comma after the last item, or smart quotes pasted from a document.`,
    };
  }

  /* Accept a bare array, or an object wrapping one under a plausible key. */
  let list: unknown = data;
  if (!Array.isArray(list) && list && typeof list === "object") {
    const obj = list as Record<string, unknown>;
    const key = ["questions", "items", "data", "rows"].find((k) => Array.isArray(obj[k]));
    if (key) list = obj[key];
    else list = [list];
  }
  if (!Array.isArray(list)) {
    return {
      ...empty,
      fatal: "Expected a JSON array of question objects, or an object with a `questions` array.",
    };
  }
  if (list.length === 0) return { ...empty, fatal: "That JSON array is empty." };
  if (list.length > MAX_ROWS) {
    return {
      ...empty,
      fatal: `That's ${list.length} questions — the limit is ${MAX_ROWS} per import. Split it into smaller batches.`,
    };
  }

  const unknownAll = new Set<string>();
  const rows = list.map((item: unknown, i: number) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return { index: i + 1, question: null, errors: ["Not a JSON object."], warnings: [] };
    }
    const { rec, unknown } = jsonToRecord(item);
    unknown.forEach((u) => unknownAll.add(u));
    return validateRecord(rec, i + 1);
  });

  return { rows, fatal: null, ignoredColumns: [...unknownAll] };
}

// ---------------------------------------------------------------------------
// Shared validation
// ---------------------------------------------------------------------------

/**
 * Exported for the document-import path (`src/lib/import/`), which builds the
 * same string record from a .docx or PDF and needs the *same* verdicts a pasted
 * spreadsheet gets. Two validators would drift, and the one that drifts is
 * always the one nobody re-reads.
 */
export function validateRecord(rec: Record<string, string>, index: number): RowResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const get = (k: string) => (rec[k] ?? "").trim();

  // --- section (required) ---
  const sectionRaw = get("section");
  const section = parseSection(sectionRaw);
  if (!section) {
    errors.push(
      sectionRaw
        ? `Section "${sectionRaw}" isn't recognised — use "math" or "reading_writing".`
        : 'Section is missing — use "math" or "reading_writing".',
    );
  }

  // --- question text (required) ---
  const question_text = get("question_text");
  if (!question_text) errors.push("Question text is empty.");

  // --- skill (required, must belong to the section) ---
  const skillRaw = get("skill");
  let skill: string | null = null;
  if (section) {
    skill = matchSkill(skillRaw, section);
    if (!skill) {
      const valid = skillsFor(section).join(", ");
      errors.push(
        skillRaw
          ? `Skill "${skillRaw}" isn't a valid ${section === "math" ? "Math" : "Reading & Writing"} skill. Valid: ${valid}.`
          : `Skill is missing. Valid for this section: ${valid}.`,
      );
    }
  }

  // --- difficulty (defaults to C) ---
  const diffRaw = get("difficulty");
  let difficulty: Difficulty = "C";
  if (diffRaw) {
    const d = parseDifficulty(diffRaw);
    if (!d) {
      errors.push(
        `Difficulty "${diffRaw}" isn't recognised — use one of ${LETTER_DIFFICULTIES.join(", ")} (S is hardest), or easy/medium/hard.`,
      );
    } else {
      difficulty = d;
    }
  } else {
    warnings.push("No difficulty given — defaulting to C.");
  }

  // --- choices ---
  const choices: { id: string; text: string }[] = [];
  for (const id of CHOICE_IDS) {
    const t = (rec[`choice_${id}`] ?? "").trim();
    if (t) choices.push({ id, text: t });
  }

  // --- kind: explicit, else inferred from whether choices are present ---
  const kindRaw = get("kind");
  let kind: QuestionKind;
  if (kindRaw) {
    const k = parseKind(kindRaw);
    if (!k) {
      errors.push(`Kind "${kindRaw}" isn't recognised — use "multiple_choice" or "grid_in".`);
      kind = choices.length > 0 ? "multiple_choice" : "grid_in";
    } else {
      kind = k;
    }
  } else {
    kind = choices.length > 0 ? "multiple_choice" : "grid_in";
  }

  // --- correct answer ---
  const correctRaw = get("correct");
  let correct_choice_id: string | null = null;
  let correct_grid_answers: string[] | null = null;

  if (kind === "multiple_choice") {
    if (choices.length < 2) {
      errors.push(
        `A multiple-choice question needs at least 2 choices — found ${choices.length}. ` +
          "Use columns A, B, C, D (or a `choices` array in JSON).",
      );
    }
    /* Gaps would misalign the answer letter with the choice it names. */
    const expected = CHOICE_IDS.slice(0, choices.length);
    if (choices.some((c, i) => c.id !== expected[i])) {
      errors.push(
        `Choices must be filled in order without gaps — got ${choices.map((c) => c.id).join(", ")}.`,
      );
    }
    if (!correctRaw) {
      errors.push("No correct answer given.");
    } else {
      const v = correctRaw.trim();
      const byLetter = v.toUpperCase().replace(/[^A-H]/g, "");
      const byIndex = /^\d+$/.test(v) ? Number(v) - 1 : -1;
      if (byLetter.length === 1 && choices.some((c) => c.id === byLetter)) {
        correct_choice_id = byLetter;
      } else if (byIndex >= 0 && byIndex < choices.length) {
        correct_choice_id = choices[byIndex].id;
      } else {
        /* Last resort: the answer was written out as the choice's own text. */
        const hit = choices.find((c) => normValue(c.text) === normValue(v));
        if (hit) correct_choice_id = hit.id;
        else {
          errors.push(
            `Correct answer "${correctRaw}" doesn't match any choice. Use a letter (${choices.map((c) => c.id).join("/") || "A/B/C/D"}) or the exact choice text.`,
          );
        }
      }
    }
  } else {
    if (choices.length > 0) {
      warnings.push("Grid-in question — the choice columns were ignored.");
    }
    if (!correctRaw) {
      errors.push("No accepted answer given for this grid-in question.");
    } else {
      correct_grid_answers = splitAnswers(correctRaw);
      if (correct_grid_answers.length === 0)
        errors.push("No accepted answer given for this grid-in question.");
    }
  }

  // --- optional metadata ---
  const monthParsed = parseMonth(get("source_month"));
  let source_month: number | null = null;
  if (monthParsed === "invalid") {
    warnings.push(`Source month "${get("source_month")}" isn't a month — left blank.`);
  } else {
    source_month = monthParsed;
  }

  let source_year: number | null = null;
  const yearRaw = get("source_year");
  if (yearRaw) {
    const y = Number(yearRaw);
    if (!Number.isFinite(y) || y < 2000 || y > 2099) {
      warnings.push(`Source year "${yearRaw}" is out of range (2000–2099) — left blank.`);
    } else {
      source_year = Math.round(y);
    }
  }
  if (source_month != null && source_year == null) {
    warnings.push("Source month without a year won't display — both are needed.");
  }

  let time_limit_seconds: number | null = null;
  const secRaw = get("time_limit_seconds");
  const minRaw = get("time_limit_minutes");
  if (secRaw) {
    const n = Number(secRaw);
    if (!Number.isFinite(n) || n <= 0)
      warnings.push(`Time limit "${secRaw}" isn't a positive number — left blank.`);
    else time_limit_seconds = Math.round(n);
  } else if (minRaw) {
    const n = Number(minRaw);
    if (!Number.isFinite(n) || n <= 0)
      warnings.push(`Time limit "${minRaw}" isn't a positive number — left blank.`);
    else time_limit_seconds = Math.round(n * 60);
  }

  const image_url = get("image_url") || null;
  if (image_url && !/^https?:\/\//i.test(image_url)) {
    warnings.push("Image URL doesn't start with http(s) — it may not load.");
  }

  /* Unbalanced $ means a LaTeX span was left open, which renders as raw text. */
  for (const [label, value] of [
    ["question text", question_text],
    ["prompt", get("prompt")],
    ["explanation", get("explanation")],
  ] as const) {
    const singles = (value.match(/(?<!\$)\$(?!\$)/g) ?? []).length;
    if (singles % 2 === 1)
      warnings.push(`Odd number of $ in the ${label} — check the math delimiters.`);
  }

  if (errors.length > 0) return { index, question: null, errors, warnings };

  return {
    index,
    question: {
      section: section as Section,
      skill: skill as string,
      difficulty,
      kind,
      prompt: get("prompt") || null,
      question_text,
      choices: kind === "multiple_choice" ? choices : [],
      correct_choice_id,
      correct_grid_answers,
      explanation: get("explanation") || null,
      image_url,
      source_month,
      source_year,
      time_limit_seconds,
    },
    errors,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

/** Loose key for comparing question text across a batch and the existing bank. */
export function dedupeKey(section: string, questionText: string): string {
  return section + "|" + questionText.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Flag rows whose question text repeats earlier in the batch or already exists
 * in the bank. Warnings only — re-importing a corrected batch is legitimate,
 * so the decision stays with the user.
 */
export function flagDuplicates(rows: RowResult[], existingKeys: Set<string>): RowResult[] {
  const seen = new Set<string>();
  return rows.map((r) => {
    if (!r.question) return r;
    const key = dedupeKey(r.question.section, r.question.question_text);
    const warnings = [...r.warnings];
    let duplicate = false;
    if (seen.has(key)) {
      warnings.push("Duplicate of an earlier row in this batch.");
      duplicate = true;
    } else if (existingKeys.has(key)) {
      warnings.push("A question with this text already exists in the bank.");
      duplicate = true;
    }
    seen.add(key);
    return { ...r, warnings, duplicate };
  });
}

// ---------------------------------------------------------------------------
// Templates, shown in the UI and copyable
// ---------------------------------------------------------------------------

export const TSV_COLUMNS = [
  "section",
  "skill",
  "difficulty",
  "kind",
  "prompt",
  "question_text",
  "A",
  "B",
  "C",
  "D",
  "correct",
  "explanation",
  "source_month",
  "source_year",
  "time_limit_minutes",
  "image_url",
] as const;

export const TSV_TEMPLATE = [
  TSV_COLUMNS.join("\t"),
  [
    "math",
    "Algebra",
    "B",
    "multiple_choice",
    "",
    "If $3x + 5 = 20$, what is the value of $x$?",
    "3",
    "5",
    "15",
    "25",
    "B",
    "$3x = 15$, so $x = 5$.",
    "",
    "",
    "",
    "",
  ].join("\t"),
  [
    "math",
    "Geometry and Trigonometry",
    "A",
    "grid_in",
    "",
    "A circle has radius 4. What is its area, in terms of $\\pi$?",
    "",
    "",
    "",
    "",
    "16pi, 16\\pi",
    "$A = \\pi r^2 = 16\\pi$.",
    "",
    "",
    "",
    "",
  ].join("\t"),
  [
    "reading_writing",
    "Craft and Structure",
    "B",
    "multiple_choice",
    "Naturalists once assumed the cuttlefish changed colour only to hide. Recent work suggests the displays are also social.",
    'As used in the text, "social" most nearly means',
    "communicative",
    "friendly",
    "public",
    "fashionable",
    "A",
    "The displays convey information to other cuttlefish.",
    "",
    "",
    "",
    "",
  ].join("\t"),
].join("\n");

export const JSON_TEMPLATE = `[
  {
    "section": "math",
    "skill": "Algebra",
    "difficulty": "B",
    "kind": "multiple_choice",
    "question_text": "If $3x + 5 = 20$, what is the value of $x$?",
    "choices": ["3", "5", "15", "25"],
    "correct": "B",
    "explanation": "$3x = 15$, so $x = 5$."
  },
  {
    "section": "math",
    "skill": "Geometry and Trigonometry",
    "difficulty": "A",
    "kind": "grid_in",
    "question_text": "A circle has radius 4. What is its area, in terms of $\\\\pi$?",
    "correct": ["16pi", "16\\\\pi"],
    "explanation": "$A = \\\\pi r^2 = 16\\\\pi$."
  },
  {
    "section": "reading_writing",
    "skill": "Craft and Structure",
    "difficulty": "B",
    "kind": "multiple_choice",
    "prompt": "Naturalists once assumed the cuttlefish changed colour only to hide.\\n\\nRecent work suggests the displays are also social.",
    "question_text": "As used in the text, \\"social\\" most nearly means",
    "choices": ["communicative", "friendly", "public", "fashionable"],
    "correct": "A",
    "explanation": "The displays convey information to other cuttlefish."
  }
]`;
