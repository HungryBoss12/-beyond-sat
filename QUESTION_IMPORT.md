# Question Import Guide

Two formats are accepted: **Spreadsheet (TSV/CSV)** and **JSON**. Paste into `/admin/import`
(ordinary) or `/admin/sqb/import` (SQB). The parser is tolerant of column-name variations and
common aliases.

---

## Spreadsheet format (TSV / CSV)

Copy from Google Sheets or Excel and paste directly. The first row must be a header.

| Column               | Required | Notes                                                                                               |
| -------------------- | -------- | --------------------------------------------------------------------------------------------------- |
| `section`            | ✓        | `math` or `reading_writing` (also accepts `rw`, `english`, `reading`, etc.)                         |
| `skill`              | ✓        | See skill lists below. Partial matches work (`Algebra`, `Craft`, etc.)                              |
| `question_text`      | ✓        | Also accepted: `question`, `text`, `stem`                                                           |
| `A` `B` `C` `D`      | MC only  | Also accepted: `choice_a`, `option_a`, `answer_a`, `choice_1` …                                     |
| `correct`            | ✓        | Letter (`B`), number (`2`), or the choice's own text. For grid-in: comma/semicolon-separated values |
| `difficulty`         |          | `C` `D` `B` `A` `S`, easiest to hardest. Or `easy`/`medium`/`hard`. Defaults to `C`                 |
| `kind`               |          | `multiple_choice` or `grid_in`. Inferred from choices if omitted                                    |
| `prompt`             |          | Passage / stimulus. Also accepted: `passage`, `stimulus`, `context`                                 |
| `explanation`        |          | Also accepted: `rationale`, `solution`, `why`                                                       |
| `source_month`       |          | Number (3) or name (March)                                                                          |
| `source_year`        |          | Four-digit year                                                                                     |
| `time_limit_minutes` |          | Decimal OK (`1.5` → 90 s). Also accepted: `time_limit`                                              |
| `image_url`          |          | Must start with `https://` (or a storage path)                                                  |
| `bank_format`        |          | `ordinary` (default) or `sqb`. SQB rows import as **unpublished drafts**.                       |
| `external_id`        |          | Optional unique display id (e.g. hex). Also accepted: `question_id`, `sqb_id`                   |
| `assessment`         |          | e.g. `SAT`                                                                                      |
| `subskill`           |          | Fine skill under the Domain/`skill` family (required to publish SQB items)                      |
| `image_alt`          |          | Required to publish SQB when `image_url` is set                                                 |
| `published`          |          | Ignored for SQB imports (always draft). Ordinary defaults to published.                         |

Cells with embedded newlines (e.g. multi-paragraph passages) must be quoted — Google Sheets does
this automatically when you copy. Use `""` inside a quoted cell for a literal quote character.

### SQB import entry

Open `/admin/sqb/import` (hub **New SQB test**). That is a **three-stage** flow: **JSON** (questions)
→ **Review** → **Answers** (answers JSON) → Save. It always stamps `bank_format=sqb` on questions
and linked tests, saves **unpublished drafts**, and requires a rights confirmation. After save, use
`/admin/sqb/review/$testId` before Publish.

Paste or drop a questions JSON array (Load template includes an SQB sample). On the Answers step,
paste `[{ "external_id": "…", "correct": "C" }, …]` (or `{ "answers": […] }`). Ordinary
`/admin/import?bank=sqb` redirects here. Never paste College Board copyrighted stems — author
original or rights-cleared content only.

---

## JSON format

An array of objects, or `{ "questions": [...] }`. Each object:

```json
{
  "section": "math",
  "skill": "Algebra",
  "difficulty": "B",
  "kind": "multiple_choice",
  "prompt": "optional passage",
  "question_text": "If $3x + 5 = 20$, what is $x$?",
  "choices": ["3", "5", "15", "25"],
  "correct": "B",
  "explanation": "$3x = 15$, so $x = 5$.",
  "source_month": 3,
  "source_year": 2026,
  "time_limit_minutes": 1.5,
  "image_url": "https://..."
}
```

SQB example (draft):

```json
{
  "section": "math",
  "skill": "Geometry and Trigonometry",
  "subskill": "Circles",
  "difficulty": "B",
  "kind": "multiple_choice",
  "bank_format": "sqb",
  "external_id": "demo01ab",
  "assessment": "SAT",
  "question_text": "In the figure above, what is the radius of circle $O$?",
  "choices": ["2", "3", "4", "5"],
  "correct": "C",
  "image_alt": "Circle O with labeled radius"
}
```

`choices` accepts three shapes:

- Array of strings: `["3", "5", "15", "25"]` → assigned A, B, C, D
- Array of objects: `[{"id": "A", "text": "3"}, ...]`
- Object: `{"A": "3", "B": "5", "C": "15", "D": "25"}`

`correct` for grid-in: a string (`"16pi"`) or array (`["16pi", "16\\pi"]`).

### SQB answers JSON (import step 3)

Array or `{ "answers": [...] }`. Matched onto drafts by `external_id` / `question_id` / `sqb_id`
(fallback: pack order).

```json
[
  { "external_id": "demo01ab", "correct": "C", "explanation": "Optional rationale." },
  { "external_id": "demo02cd", "correct": "B" },
  { "correct": "3/4" }
]
```

---

## Skill lists

**Math**

- Algebra
- Advanced Math
- Problem-Solving and Data Analysis
- Geometry and Trigonometry

**Reading & Writing**

- Craft and Structure
- Information and Ideas
- Standard English Conventions
- Expression of Ideas

A skill must belong to the row's section — `Algebra` on a `reading_writing` row is an error, not a
warning, so the row won't import.

---

## Difficulty

The letters are not alphabetical. Ordered easiest to hardest:

`C` → `D` → `B` → `A` → `S`

`easy`, `medium`, and `hard` are accepted and folded onto `C`, `B`, and `A` respectively, so a mixed
import doesn't end up with two spellings of the same difficulty.

---

## Math / LaTeX

Wrap inline math in single dollar signs: `$3x + 5 = 20$`.  
Use `\\pi`, `\\frac{a}{b}`, `\\sqrt{x}` etc. (double-backslash in JSON strings).

---

## LLM prompt for extracting questions from a PDF

Use this prompt with any capable LLM (paste the PDF text or screenshot after it).
The output can be pasted directly into the JSON tab on the Import page.

```
Extract every SAT practice question from the text below and return a JSON array.
Each element must be an object with these fields:

  section        — "math" or "reading_writing"
  skill          — one of:
                     Math: "Algebra", "Advanced Math",
                           "Problem-Solving and Data Analysis",
                           "Geometry and Trigonometry"
                     Reading & Writing: "Craft and Structure",
                           "Information and Ideas",
                           "Standard English Conventions",
                           "Expression of Ideas"
  difficulty     — one of "C", "D", "B", "A", "S", ordered easiest to hardest
                   ("C" is the easiest, "S" is the hardest).
                   If the source doesn't state a difficulty, omit the field.
  kind           — "multiple_choice" or "grid_in"
  prompt         — the passage or stimulus, if any (preserve line breaks as \n)
  question_text  — the question stem only (no answer choices)
  choices        — array of strings ["...", "...", "...", "..."] for MC questions;
                   omit for grid-in
  correct        — the correct answer letter ("A"–"D") for MC, or an array of
                   accepted values (["16pi", "16\\pi"]) for grid-in
  explanation    — worked solution, if provided; otherwise omit
  source_month   — integer month if identifiable from the source
  source_year    — four-digit year if identifiable from the source

Rules:
- Preserve all math exactly as written. Wrap expressions in $...$, e.g. $3x+5=20$.
  Use LaTeX notation: \\frac{a}{b}, \\sqrt{x}, \\pi, \\leq, etc.
- For Reading & Writing questions with a shared passage, copy the full passage into
  the "prompt" field of every question that uses it.
- Do not add, remove, or paraphrase any answer choices.
- Output only the JSON array — no markdown fences, no commentary.

[PASTE PDF TEXT OR DESCRIBE SCREENSHOT HERE]
```

### Tips

- If the PDF has multiple sections, run the prompt once per section and combine the arrays.
- For scanned PDFs, paste the OCR text or describe the image; the LLM will still extract correctly.
- After pasting the JSON output into the Import page, click **Check** to validate before importing.
  Any rows with errors are shown in red and skipped; fix them in the source and re-paste.
- The duplicate detector compares question text (case- and whitespace-insensitive) against the
  existing bank. Re-importing a corrected batch is safe — duplicates are flagged but you can
  choose to import them anyway.
