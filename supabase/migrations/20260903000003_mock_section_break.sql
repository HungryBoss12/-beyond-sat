-- Section break between Reading & Writing and Math on full mock exams.
ALTER TABLE public.mock_exams
  ADD COLUMN IF NOT EXISTS section_break_seconds integer NOT NULL DEFAULT 1200;

COMMENT ON COLUMN public.mock_exams.section_break_seconds IS
  'Break between R&W and Math sections, in seconds. Default 1200 (20 minutes).';
