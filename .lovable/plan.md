This is a large change touching schema, admin UX, onboarding, and mock/daily editors. Here is what I will build:

## 1. Admin panel — sidebar layout

- Replace the top pill-nav in `admin.tsx` with a persistent left sidebar (Overview, Questions, Tests, Daily Tests, Mock Exams, News, Users).
- The AppShell's own sidebar/bottom-nav is hidden while under `/admin/*`, so admins see one dedicated admin sidebar (with a small "Back to app" link at the bottom). Mobile: sidebar collapses into a hamburger drawer — no bottom tab bar under admin.
- Keeps the existing Overview stats page as the landing view.

## 2. Onboarding + Profile — single field

- Onboarding wizard collapses to one step: "How much time until your exam?" (exam date picker). Target score / fears / current level steps removed from the flow (columns kept in DB for now, just not asked).
- Profile "Goals" panel edits only the exam date. Everything else on profile (personal info, history, streaks, stats) stays.

## 3. Question authoring — new fields

Add to `questions` table and the admin question editor:

- `image_url` (text, nullable) — upload via a new public `question-images` storage bucket.
- `source_month` (int 1-12, nullable) and `source_year` (int, nullable) — rendered as "March 2023".
- Difficulty enum widens from easy/medium/hard to **C, B, D, A, S** (S = highest). Existing rows migrate: easy→C, medium→B, hard→A. Filters and skill browser update to the new scale.

## 4. New "Tests" concept (groups of questions)

New tables:

- `tests` — `id, title, source_month, source_year, difficulty (C/B/D/A/S), module (1 or 2), section (reading_writing | math), created_by, created_at`.
- `test_questions` — `test_id, question_id, position` (unique test_id+position). A test must contain **≥ 2 questions** (enforced client-side on save + a DB trigger on publish).

New admin page `/admin/tests`:

- List view grouped by Module 1 / Module 2.
- Create/edit modal: title, month+year, difficulty, module, section, question picker (from existing question bank) with min-2 validation.
- Individual questions remain fully usable in the existing `/admin/questions` page — this is additive.

## 5. Daily tests editor — pick multiple tests

- `daily_tests` gains a link table `daily_test_tests (daily_test_id, test_id, position)`.
- Admin daily editor switches from picking individual questions to a multi-select list of published tests. On the student side, daily runs flatten selected tests → their questions in order. The existing `daily_test_questions` table stays for backward compatibility.

## 6. Mock exams — composed of tests, 4 sections × 2 modules

- New table `mock_exam_sections`: `mock_exam_id, module (1|2), section_index (1..4), section_name, test_id`. Four named slots per module (8 total per exam). Admin picks one test per slot from the tests library, filtered by module.
- The mock exam editor gets a grid: Module 1 → 4 dropdowns, Module 2 → 4 dropdowns. Existing timing/threshold/publish controls remain.
- The student mock runner flattens the 8 chosen tests into the question sequence.

## Technical notes

- Migration order: widen difficulty enum, add columns to `questions`, create `tests` + `test_questions`, create `daily_test_tests`, create `mock_exam_sections`, GRANTs + RLS (admin write, authenticated read for published).
- Storage: `question-images` public bucket + policies (admin write, public read).
- All new admin routes gated by the existing admin `beforeLoad` check.
- Backfill: existing daily_tests / mocks keep working via legacy question links until re-edited.

Scope kept intentionally: no changes to news, streaks, dashboard analytics, or the test player UI (it already reads a flat question list). If you'd rather I split this into two shippable chunks (1: sidebar + onboarding + question metadata; 2: Tests layer + daily/mock rewiring), say the word — otherwise I'll build it all in one pass.
