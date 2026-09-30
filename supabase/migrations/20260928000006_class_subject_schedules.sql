-- Separate Math and English days and times on one class.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS math_schedule_days smallint[],
  ADD COLUMN IF NOT EXISTS math_start_time time,
  ADD COLUMN IF NOT EXISTS math_end_time time,
  ADD COLUMN IF NOT EXISTS ebrw_schedule_days smallint[],
  ADD COLUMN IF NOT EXISTS ebrw_start_time time,
  ADD COLUMN IF NOT EXISTS ebrw_end_time time;

UPDATE public.classes
SET
  math_schedule_days = COALESCE(math_schedule_days, schedule_days),
  math_start_time = COALESCE(math_start_time, start_time),
  math_end_time = COALESCE(math_end_time, end_time),
  ebrw_schedule_days = COALESCE(ebrw_schedule_days, schedule_days),
  ebrw_start_time = COALESCE(ebrw_start_time, start_time),
  ebrw_end_time = COALESCE(ebrw_end_time, end_time);

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_math_days_ok;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_math_days_ok
  CHECK (math_schedule_days IS NULL OR math_schedule_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_ebrw_days_ok;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_ebrw_days_ok
  CHECK (ebrw_schedule_days IS NULL OR ebrw_schedule_days <@ ARRAY[1,2,3,4,5,6,7]::smallint[]);

CREATE OR REPLACE FUNCTION public.ensure_class_lessons(p_class_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_math smallint[];
  v_eng smallint[];
  v_start date;
  v_end date;
  v_day date;
  v_added int := 0;
  v_dow int;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT
    COALESCE(math_schedule_days, schedule_days),
    COALESCE(ebrw_schedule_days, schedule_days)
  INTO v_math, v_eng
  FROM public.classes
  WHERE id = p_class_id;
  IF (v_math IS NULL OR cardinality(v_math) = 0)
     AND (v_eng IS NULL OR cardinality(v_eng) = 0) THEN
    RETURN 0;
  END IF;
  v_start := date_trunc('month', p_month)::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_day := v_start;
  WHILE v_day <= v_end LOOP
    v_dow := EXTRACT(ISODOW FROM v_day)::int;
    IF v_math IS NOT NULL AND v_dow = ANY (v_math) THEN
      INSERT INTO public.class_lessons (class_id, lesson_date, subject, created_by)
      VALUES (p_class_id, v_day, 'math', auth.uid())
      ON CONFLICT (class_id, lesson_date, subject) DO NOTHING;
      IF FOUND THEN
        v_added := v_added + 1;
      END IF;
    END IF;
    IF v_eng IS NOT NULL AND v_dow = ANY (v_eng) THEN
      INSERT INTO public.class_lessons (class_id, lesson_date, subject, created_by)
      VALUES (p_class_id, v_day, 'ebrw', auth.uid())
      ON CONFLICT (class_id, lesson_date, subject) DO NOTHING;
      IF FOUND THEN
        v_added := v_added + 1;
      END IF;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_class_lessons(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_class_lessons(uuid, date) TO authenticated;
