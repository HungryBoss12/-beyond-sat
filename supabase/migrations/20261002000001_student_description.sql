-- Free-text profile notes from the roster sheet: levels, goals, certificates.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS description text;

COMMENT ON COLUMN public.students.description IS
  'English, math, goal, and achievement notes. Not a score.';
