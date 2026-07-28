ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS time_limit_seconds integer;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS time_limit_seconds integer;