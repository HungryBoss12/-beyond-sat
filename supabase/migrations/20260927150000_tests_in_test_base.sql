-- SQB packs can sit in Test Base (not on the Tests list, unpublished)
-- until an admin adds them to Tests.

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS in_test_base boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS tests_sqb_base_idx
  ON public.tests (bank_format, in_test_base, published);
