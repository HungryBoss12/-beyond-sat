
ALTER TYPE public.sat_difficulty ADD VALUE IF NOT EXISTS 'C';
ALTER TYPE public.sat_difficulty ADD VALUE IF NOT EXISTS 'B';
ALTER TYPE public.sat_difficulty ADD VALUE IF NOT EXISTS 'D';
ALTER TYPE public.sat_difficulty ADD VALUE IF NOT EXISTS 'A';
ALTER TYPE public.sat_difficulty ADD VALUE IF NOT EXISTS 'S';

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source_month INT,
  ADD COLUMN IF NOT EXISTS source_year INT;
