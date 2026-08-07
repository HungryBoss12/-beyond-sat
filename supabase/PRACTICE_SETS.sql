-- ===========================================================================
-- PRACTICE_SETS.sql
--
-- Run this once in the Supabase SQL editor, after FRESH_PROJECT_SCHEMA.sql.
-- Safe to re-run: every statement is idempotent.
--
-- What it does: gives `public.tests` a `published` flag and stops students
-- seeing sets that aren't published yet. This is what makes the new dated-set
-- practice screen (`/practice/reading_writing`, `/practice/math`) safe to ship —
-- without it, a half-imported paper appears on the student's list the moment the
-- first question lands.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) The flag
--
-- Defaults to TRUE, deliberately. Every `tests` row that already exists was
-- created before this column and is presumed finished; defaulting to FALSE would
-- silently empty the practice screen on deploy. The cost is the opposite risk —
-- a half-built set going live — so read §3 below and flip those to FALSE BEFORE
-- the new practice screen ships.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT TRUE;

-- ---------------------------------------------------------------------------
-- 2) The read policy
--
-- Replaces `USING (true)` with the same shape `mock_exams` has used since the
-- schema was written (FRESH_PROJECT_SCHEMA.sql:267): students see published sets,
-- admins see everything, so the admin editor keeps working unchanged.
--
-- `test_questions` is deliberately left at `USING (true)`. It looks like the
-- obvious next thing to lock down, and locking it down breaks daily tests and
-- mock exams: `questionsForTests()` (src/lib/session.ts) resolves a daily's or a
-- mock's questions through `test_questions` alone, so a daily built on an
-- unpublished set would resolve to zero questions and fail at run time. What
-- `test_questions` exposes is a list of UUIDs; the practice screen never queries
-- it for an unlisted set, and `startTestSetSession()` checks `tests` for
-- readability before it will start one.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "tests read auth" ON public.tests;
DROP POLICY IF EXISTS "tests read published" ON public.tests;
CREATE POLICY "tests read published" ON public.tests
  FOR SELECT TO authenticated
  USING (published OR public.has_role(auth.uid(), 'admin'));

-- Filtering and grouping the practice screen both key on these.
CREATE INDEX IF NOT EXISTS idx_tests_section_published
  ON public.tests (section, published);
CREATE INDEX IF NOT EXISTS idx_tests_source_date
  ON public.tests (source_year DESC, source_month DESC);

-- ---------------------------------------------------------------------------
-- 3) Before you deploy: audit what just became student-visible
--
-- Run this and look at the result. Anything with a low `questions` count, a
-- placeholder title, or no source date is almost certainly half-built.
-- ---------------------------------------------------------------------------
-- SELECT t.id, t.title, t.section, t.module, t.source_month, t.source_year,
--        t.published, COUNT(tq.question_id) AS questions
--   FROM public.tests t
--   LEFT JOIN public.test_questions tq ON tq.test_id = t.id
--  GROUP BY t.id
--  ORDER BY t.source_year DESC NULLS LAST, t.source_month DESC NULLS LAST;

-- Then hide the ones that aren't ready. Two ready-made versions:

-- Everything with fewer than 5 questions:
-- UPDATE public.tests SET published = FALSE
--  WHERE id IN (
--    SELECT t.id FROM public.tests t
--    LEFT JOIN public.test_questions tq ON tq.test_id = t.id
--    GROUP BY t.id HAVING COUNT(tq.question_id) < 5
--  );

-- Or start closed and publish deliberately, which is the safer order:
-- UPDATE public.tests SET published = FALSE;
-- UPDATE public.tests SET published = TRUE WHERE id IN ('…', '…');
