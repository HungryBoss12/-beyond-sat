# Question Extraction Prompt

Copy everything in the block below into an AI (Claude, ChatGPT, Gemini — anything that accepts file
uploads), then attach your PDF, images, or screenshots. The output can be pasted straight into the
**JSON** tab at `/admin/import`.

The rules in this prompt mirror exactly what the importer validates, so a compliant response imports
with zero errors. Format reference: [QUESTION_IMPORT.md](QUESTION_IMPORT.md).

---

## The prompt

````
You are extracting SAT practice questions from the attached material into JSON for a
question-bank importer. Accuracy matters more than speed: this content is shown to
students as-is, so never guess, never paraphrase, and never invent a question.

## Output

Return ONLY a JSON array of question objects. No markdown code fences, no commentary,
no preamble, no trailing text. The very first character must be `[` and the last `]`.

If there are more than 50 questions, return the first 50 and end your message with a
single line after the closing bracket:
MORE_REMAINING: <number>
I will then ask you to continue from that point.

## Object shape

Every object uses these fields. Omit any optional field you cannot determine —
do NOT emit null, empty strings, or placeholder text like "N/A" or "unknown".

  section        REQUIRED. Exactly "math" or "reading_writing".

  skill          REQUIRED. Exactly one of these strings, matching the section:
                   math:
                     "Algebra"
                     "Advanced Math"
                     "Problem-Solving and Data Analysis"
                     "Geometry and Trigonometry"
                   reading_writing:
                     "Craft and Structure"
                     "Information and Ideas"
                     "Standard English Conventions"
                     "Expression of Ideas"
                 Pick the closest fit based on what the question actually tests.
                 A math skill on a reading_writing question is an error, and vice versa.

  kind           REQUIRED. "multiple_choice" or "grid_in".
                 grid_in = student types a numeric answer, no answer choices.

  question_text  REQUIRED. The question stem ONLY. Do not include the answer
                 choices, the question number, or the passage.

  choices        REQUIRED for multiple_choice, OMIT for grid_in.
                 A JSON array of 4 strings in original order: ["...","...","...","..."].
                 They map to A, B, C, D by position. Text only — do not prefix
                 "A)" or "(A)". Never reorder, reword, or drop a choice.

  correct        REQUIRED.
                 multiple_choice: the letter as a string — "A", "B", "C", or "D".
                 grid_in: an ARRAY of every acceptable form of the answer,
                   e.g. ["1/2", "0.5", ".5"] or ["16pi", "16\\pi"].
                 If the source does not state the answer, omit the ENTIRE question
                 rather than guessing. See "When to skip" below.

  prompt         OPTIONAL. The passage, stimulus, chart description, or intro text.
                 Use "\n\n" between paragraphs. When several questions share one
                 passage, repeat the full passage in EVERY one of those questions.

  explanation    OPTIONAL. The worked solution or rationale, if the source has one.
                 Do not write your own if the source doesn't provide it.

  difficulty     OPTIONAL. One of "C", "D", "B", "A", "S".
                 This scale is NOT alphabetical. Easiest to hardest it runs:
                   C  →  D  →  B  →  A  →  S
                 Only include this if the source explicitly labels a difficulty.
                 Omit it otherwise — do not estimate.

  source_month   OPTIONAL. Integer 1-12, only if the source names the exam month.
  source_year    OPTIONAL. Four-digit integer 2000-2099, only if the source names it.
                 Include both or neither; a month without a year won't display.

  time_limit_minutes  OPTIONAL. Number, e.g. 1.5. Only if the source specifies one.

## Math formatting

Wrap every mathematical expression in single dollar signs: $3x + 5 = 20$.
Use standard LaTeX inside them: \frac{a}{b}, \sqrt{x}, x^{2}, \pi, \leq, \geq, \neq,
\times, \div, \angle, \triangle, \circ.

Because this is JSON, every backslash must be DOUBLED in your output.
You want the reader to see:  $\frac{1}{2}$
So you must write:           "$\\frac{1}{2}$"

Dollar signs must be balanced — an odd count means an unclosed expression.
For a literal currency amount, write it as math: $\$5$ (in JSON: "$\\$5$").

## Numbers

Never use thousands separators. Write 1500, not 1,500. A comma inside a grid-in
answer is read as a separator between two different answers and will corrupt it.
Use a period for decimals.

## Figures and images

If a question depends on a graph, diagram, or table, transcribe what it shows in the
`prompt` field as precisely as you can — data-table values, axis labels, coordinates,
labelled side lengths and angles. Then add this marker on its own line at the end of
`prompt`:
[FIGURE NEEDED: one-line description]
Never emit an `image_url` field; images are attached by hand after import.

## When to skip a question

Leave a question out of the array entirely if any of these is true:
  - The correct answer is not stated anywhere in the source.
  - The stem or a choice is cut off, illegible, or partially cropped.
  - It depends on a figure whose content you cannot read well enough to transcribe.
  - It is an example worked through in instructional text, not an actual question.
It is far better to omit a question than to import a wrong or truncated one.

After the closing `]`, if you skipped anything, add one line:
SKIPPED: <count> — <brief reason for each>

## Hard requirements

  - Valid JSON. No trailing commas. Straight quotes only (" not " or ").
  - Preserve original wording exactly, including any typos in the source.
  - Do not merge, split, renumber, or reorder questions.
  - Do not add fields beyond those listed above.

## Example output

[
  {
    "section": "math",
    "skill": "Algebra",
    "kind": "multiple_choice",
    "question_text": "If $3x + 5 = 20$, what is the value of $x$?",
    "choices": ["3", "5", "15", "25"],
    "correct": "B",
    "explanation": "Subtracting 5 gives $3x = 15$, so $x = 5$."
  },
  {
    "section": "math",
    "skill": "Geometry and Trigonometry",
    "kind": "grid_in",
    "question_text": "A circle has radius 4. What is its area, in terms of $\\pi$?",
    "correct": ["16pi", "16\\pi"]
  },
  {
    "section": "reading_writing",
    "skill": "Craft and Structure",
    "kind": "multiple_choice",
    "prompt": "Naturalists once assumed the cuttlefish changed colour only to hide.\n\nRecent work suggests the displays are also social.",
    "question_text": "As used in the text, \"social\" most nearly means",
    "choices": ["communicative", "friendly", "public", "fashionable"],
    "correct": "A"
  }
]

The material to extract from is attached.
````

---

## After you get the output

1. Copy the JSON (everything from `[` to `]` — leave out any `MORE_REMAINING` or `SKIPPED` line).
2. Go to **Admin → Import**, open the **JSON** tab, paste, and press **Check**.
3. The preview renders every question with its math and flags problems per row. Rows with errors are
   listed in red and are skipped on import; warnings still import.
4. Fix anything flagged, then press Import.

### If a row comes back with an error

| Error | Cause |
|---|---|
| `Skill "..." isn't a valid Math skill` | The AI used a Reading & Writing skill on a math row, or invented one. Correct it to a name from the list. |
| `Correct answer "..." doesn't match any choice` | The answer letter points at a choice that isn't there. Check the choices array has all four. |
| `Choices must be filled in order without gaps` | A choice came back as an empty string. |
| `isn't valid JSON` | Usually a trailing comma, or smart quotes — ask the AI to re-emit as strict JSON. |

A warning about an odd number of `$` means a math expression was left unclosed — worth fixing, since
it renders as literal text.

### Verifying a batch

Spot-check a few rows in the preview before importing, particularly the answer key. The importer
validates structure, not correctness — it cannot tell you the AI picked the wrong letter.
