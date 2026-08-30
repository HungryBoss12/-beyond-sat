-- Store notification visibility duration in seconds (not hours).

ALTER TABLE public.vocab_homework_assignments
  RENAME COLUMN display_hours TO display_seconds;

ALTER TABLE public.vocab_homework_assignments
  ALTER COLUMN display_seconds SET DEFAULT 604800;

-- Convert any rows still stored as hours (pre-migration values were hours).
UPDATE public.vocab_homework_assignments
SET display_seconds = display_seconds * 3600
WHERE display_seconds <= 8760;

COMMENT ON COLUMN public.vocab_homework_assignments.display_seconds IS
  'How long the linked notification stays visible, in seconds.';
