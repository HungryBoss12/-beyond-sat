-- SQB Tests: additive metadata on questions + tests.
-- Preserves ordinary flows (defaults: bank_format=ordinary, published=true).

-- ---------------------------------------------------------------------------
-- questions
-- ---------------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS bank_format text NOT NULL DEFAULT 'ordinary',
  ADD COLUMN IF NOT EXISTS external_id text,
  ADD COLUMN IF NOT EXISTS assessment text,
  ADD COLUMN IF NOT EXISTS domain text,
  ADD COLUMN IF NOT EXISTS subskill text,
  ADD COLUMN IF NOT EXISTS image_alt text,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

ALTER TABLE public.questions
  DROP CONSTRAINT IF EXISTS questions_bank_format_check;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_bank_format_check
  CHECK (bank_format IN ('ordinary', 'sqb'));

CREATE UNIQUE INDEX IF NOT EXISTS questions_external_id_unique
  ON public.questions (external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS questions_bank_format_lookup_idx
  ON public.questions (bank_format, section, skill, difficulty, published);

CREATE INDEX IF NOT EXISTS questions_bank_format_subskill_idx
  ON public.questions (bank_format, subskill);

-- ---------------------------------------------------------------------------
-- tests
-- ---------------------------------------------------------------------------
ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS bank_format text NOT NULL DEFAULT 'ordinary';

ALTER TABLE public.tests
  DROP CONSTRAINT IF EXISTS tests_bank_format_check;
ALTER TABLE public.tests
  ADD CONSTRAINT tests_bank_format_check
  CHECK (bank_format IN ('ordinary', 'sqb'));

CREATE INDEX IF NOT EXISTS tests_bank_format_lookup_idx
  ON public.tests (bank_format, section, published);

-- Column-level SELECT for authenticated (answers remain revoked).
REVOKE SELECT ON public.questions FROM authenticated;
GRANT SELECT (
  id, section, skill, difficulty, kind, prompt, question_text, choices,
  image_url, created_by, created_at, updated_at, source_month, source_year,
  time_limit_seconds, bank_format, external_id, assessment, domain, subskill,
  image_alt, published
) ON public.questions TO authenticated;

-- ---------------------------------------------------------------------------
-- Guard: a published SQB test cannot include unpublished SQB questions.
-- Ordinary questions (published=true by default) are unaffected.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bs_guard_sqb_test_publish()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.published IS TRUE AND NEW.bank_format = 'sqb' THEN
    IF EXISTS (
      SELECT 1
      FROM public.test_questions tq
      JOIN public.questions q ON q.id = tq.question_id
      WHERE tq.test_id = NEW.id
        AND q.bank_format = 'sqb'
        AND q.published IS NOT TRUE
    ) THEN
      RAISE EXCEPTION 'sqb-unpublished-questions'
        USING ERRCODE = 'check_violation',
              HINT = 'Publish all SQB questions before publishing this test.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tests_guard_sqb_publish ON public.tests;
CREATE TRIGGER trg_tests_guard_sqb_publish
  BEFORE INSERT OR UPDATE OF published, bank_format ON public.tests
  FOR EACH ROW
  EXECUTE FUNCTION public.bs_guard_sqb_test_publish();
