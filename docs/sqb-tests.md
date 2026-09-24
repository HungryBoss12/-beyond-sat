# SQB Tests

Question Bank–format practice on BeyondSAT. Students take SQB packs through the **same** practice player as ordinary tests (`TestPlayer` + `QuestionCard`). There is no separate SQB player skin.

## Admin

SQB lives under `/admin/sqb/*`:

| Surface | Path |
| --- | --- |
| Hub (tests) | `/admin/sqb` |
| Questions list | `/admin/sqb/questions` |
| Full-page authoring | `/admin/sqb/questions/$id` (use `new` for drafts) |
| **Import (JSON → Review → Answers)** | `/admin/sqb/import` |
| **Review / publish QA** | `/admin/sqb/review/$testId` |

Ordinary `/admin/import?bank=sqb` and `/admin/questions?bank=sqb` redirect into the SQB area. Editors share Content access (`EDITOR_SECTIONS` includes `/admin/sqb`).

### Three-stage import (`/admin/sqb/import`)

JSON only for questions and answers — no PDF / vision / sheet:

1. **JSON** — Paste or drop a questions JSON array (`JSON_TEMPLATE` includes an SQB sample). Optional **Name** for the pack, section, source date, Create a test set. Rights checkbox required. Parse forces `bank_format=sqb` and `published=false`. Each row needs a **Question ID** (`question_id` / `external_id` / `sqb_id`).
2. **Review** — SQB `DraftReviewer` / `DraftEditor` (Question ID, domain/skill, figures). Continue to Answers (no save yet).
3. **Answers** — Paste or drop answers JSON (`external_id` / `question_id` + `correct`, optional `explanation`). Apply by Question ID (fallback pack order). **Save** creates unpublished questions + optional named pack (`tests.module = 1`). Answers step is skippable.

Never auto-publishes. Do not seed College Board copyrighted stems from sample content.

### Answers JSON shape

```json
[
  { "external_id": "858fd1cf", "correct": "C", "explanation": "Optional rationale." },
  { "external_id": "9adb86ed", "correct": "B" },
  { "correct": "3/4" }
]
```

Also accepted: `{ "answers": [ ... ] }`, aliases `question_id` / `sqb_id`, grid-in `correct` as string or array.

### Review page

`/admin/sqb/review/$testId` is the canonical QA surface before go-live:

- Student chrome preview (`QuestionCard` with `ID: …` banner) + navigator with ok/warn/error dots
- Per-item QA from `validateSqbPublish` (+ duplicate Question ID in pack)
- **Publish** disabled until hard errors = 0 and every item is marked reviewed
- Hub Eye button opens Review (not only a modal preview)
- **Back to editor** restores the set into `/admin/sqb/import?testId=`

### Authoring (single question)

- Metadata: Section · Domain (`skill`) · Skill (`subskill`) · Difficulty **A → B → C** (A hardest, C easiest) · **Question ID** (required)
- Figure + **image_alt** required to publish when an image is set
- Assessment defaults to `SAT` on save (not shown in UI)
- New SQB questions start **unpublished**

### Publishing a test

A published SQB test cannot include unpublished SQB questions (admin UI gate + DB trigger `bs_guard_sqb_test_publish`). Prefer Review page Publish over ad-hoc toggles.

## Student

- Practice landing **SQB Tests** card → `/practice/sqb`
- Browse `/practice/sqb/math` and `/practice/sqb/reading_writing` (published `bank_format=sqb` only) — named packs (one Start row per title, not Module 1/2)
- Ordinary Math / Reading & Writing lists exclude SQB
- Take path unchanged: session → existing `TestPlayer` (SQB shows Question ID banner)

## Schema (additive)

`questions`: `bank_format`, `external_id`, `assessment`, `domain`, `subskill`, `image_alt`, `published`

`tests`: `bank_format`

Migration: `supabase/migrations/20260922000001_sqb_tests_schema.sql`

## Import columns

See `QUESTION_IMPORT.md`. Prefer `/admin/sqb/import` JSON; every question row is forced to `bank_format=sqb` and unpublished drafts.

## Copyright

Format/layout reference only. Do **not** seed or import College Board copyrighted stems, choices, or figures.
