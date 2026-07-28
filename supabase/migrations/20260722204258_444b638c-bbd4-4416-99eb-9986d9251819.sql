
CREATE TABLE public.exam_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_date DATE NOT NULL UNIQUE,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_dates TO authenticated;
GRANT ALL ON public.exam_dates TO service_role;

ALTER TABLE public.exam_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exam dates"
  ON public.exam_dates FOR SELECT
  USING (active = true OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage exam dates"
  ON public.exam_dates FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER exam_dates_set_updated_at
  BEFORE UPDATE ON public.exam_dates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.student_profiles
  ADD COLUMN target_rw INTEGER,
  ADD COLUMN target_math INTEGER;

-- Backfill: split existing target_score evenly if present
UPDATE public.student_profiles
   SET target_rw = GREATEST(200, LEAST(800, ROUND(target_score / 2.0)::int)),
       target_math = GREATEST(200, LEAST(800, target_score - ROUND(target_score / 2.0)::int))
 WHERE target_score IS NOT NULL AND target_rw IS NULL AND target_math IS NULL;

-- Keep target_score = target_rw + target_math automatically
CREATE OR REPLACE FUNCTION public.sync_target_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.target_rw IS NOT NULL AND NEW.target_math IS NOT NULL THEN
    NEW.target_score := NEW.target_rw + NEW.target_math;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_profiles_sync_target
  BEFORE INSERT OR UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_target_score();
