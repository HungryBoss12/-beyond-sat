-- Lessons, attendance, VAR marks, and SAT section scores.

DO $$ BEGIN
  CREATE TYPE public.var_source AS ENUM ('manual', 'auto');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.class_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  lesson_date date NOT NULL,
  subject public.class_subject,
  topic text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS class_lessons_slot_uidx
  ON public.class_lessons (class_id, lesson_date, subject) NULLS NOT DISTINCT;

ALTER TABLE public.class_lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class lessons read" ON public.class_lessons;
CREATE POLICY "class lessons read" ON public.class_lessons
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.class_memberships m
      WHERE m.class_id = class_lessons.class_id AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "class lessons staff write" ON public.class_lessons;
CREATE POLICY "class lessons staff write" ON public.class_lessons
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.class_lessons TO authenticated;
GRANT ALL ON public.class_lessons TO service_role;

CREATE OR REPLACE FUNCTION public.ensure_class_lessons(p_class_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days smallint[];
  v_start date;
  v_end date;
  v_day date;
  v_added int := 0;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT schedule_days INTO v_days FROM public.classes WHERE id = p_class_id;
  IF v_days IS NULL OR cardinality(v_days) = 0 THEN
    RETURN 0;
  END IF;
  v_start := date_trunc('month', p_month)::date;
  v_end := (v_start + interval '1 month' - interval '1 day')::date;
  v_day := v_start;
  WHILE v_day <= v_end LOOP
    IF EXTRACT(ISODOW FROM v_day)::int = ANY (v_days) THEN
      INSERT INTO public.class_lessons (class_id, lesson_date, subject, created_by)
      VALUES (p_class_id, v_day, NULL, auth.uid())
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

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY class_id, user_id, lesson_date, COALESCE(subject::text, '')
    ORDER BY created_at DESC, id DESC
  ) AS rn
  FROM public.lesson_attendance
)
DELETE FROM public.lesson_attendance a
USING ranked r
WHERE a.id = r.id AND r.rn > 1;

ALTER TABLE public.lesson_attendance
  DROP CONSTRAINT IF EXISTS lesson_attendance_class_id_user_id_lesson_date_subject_key;

CREATE UNIQUE INDEX IF NOT EXISTS lesson_attendance_slot_uidx
  ON public.lesson_attendance (class_id, user_id, lesson_date, subject) NULLS NOT DISTINCT;

CREATE OR REPLACE FUNCTION public.set_attendance(
  p_class_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_subject public.class_subject,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_state NOT IN ('present', 'absent', 'empty') THEN
    RAISE EXCEPTION 'Attendance state must be present, absent, or empty';
  END IF;
  IF p_state = 'empty' THEN
    DELETE FROM public.lesson_attendance
    WHERE class_id = p_class_id
      AND user_id = p_user_id
      AND lesson_date = p_lesson_date
      AND subject IS NOT DISTINCT FROM p_subject;
    RETURN;
  END IF;
  INSERT INTO public.lesson_attendance (
    class_id, user_id, lesson_date, subject, participated, marked_by
  )
  VALUES (
    p_class_id,
    p_user_id,
    p_lesson_date,
    p_subject,
    p_state = 'present',
    auth.uid()
  )
  ON CONFLICT (class_id, user_id, lesson_date, subject)
  DO UPDATE SET participated = EXCLUDED.participated, marked_by = EXCLUDED.marked_by;
END;
$$;

REVOKE ALL ON FUNCTION public.set_attendance(uuid, uuid, date, public.class_subject, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_attendance(uuid, uuid, date, public.class_subject, text) TO authenticated;

CREATE TABLE IF NOT EXISTS public.lesson_var_marks (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.class_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vocab boolean NOT NULL DEFAULT false,
  assignment boolean NOT NULL DEFAULT false,
  article boolean NOT NULL DEFAULT false,
  vocab_source public.var_source,
  assignment_source public.var_source,
  article_source public.var_source,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, user_id)
);

ALTER TABLE public.lesson_var_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "var marks read" ON public.lesson_var_marks;
CREATE POLICY "var marks read" ON public.lesson_var_marks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "var marks staff write" ON public.lesson_var_marks;
CREATE POLICY "var marks staff write" ON public.lesson_var_marks
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_var_marks TO authenticated;
GRANT ALL ON public.lesson_var_marks TO service_role;

CREATE OR REPLACE FUNCTION public.tick_all_complete(p_lesson_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
  v_uid uuid;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  FOREACH v_uid IN ARRAY COALESCE(p_user_ids, ARRAY[]::uuid[]) LOOP
    PERFORM public.set_attendance(v_lesson.class_id, v_uid, v_lesson.lesson_date, v_lesson.subject, 'present');
    INSERT INTO public.lesson_var_marks (
      class_id, lesson_id, user_id,
      vocab, assignment, article,
      vocab_source, assignment_source, article_source,
      updated_by, updated_at
    )
    VALUES (
      v_lesson.class_id, p_lesson_id, v_uid,
      true, true, true,
      'manual', 'manual', 'manual',
      auth.uid(), now()
    )
    ON CONFLICT (lesson_id, user_id) DO UPDATE SET
      vocab = true,
      assignment = true,
      article = true,
      vocab_source = 'manual',
      assignment_source = 'manual',
      article_source = 'manual',
      updated_by = auth.uid(),
      updated_at = now();
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.tick_all_complete(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tick_all_complete(uuid, uuid[]) TO authenticated;

CREATE TABLE IF NOT EXISTS public.student_scores (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  rw smallint NOT NULL CHECK (rw BETWEEN 200 AND 800),
  math smallint NOT NULL CHECK (math BETWEEN 200 AND 800),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.student_score_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rw smallint NOT NULL,
  math smallint NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.student_scores_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.student_score_history (user_id, rw, math, updated_by)
  VALUES (NEW.user_id, NEW.rw, NEW.math, NEW.updated_by);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_scores_history ON public.student_scores;
CREATE TRIGGER student_scores_history
  AFTER INSERT OR UPDATE ON public.student_scores
  FOR EACH ROW EXECUTE FUNCTION public.student_scores_history();

ALTER TABLE public.student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_score_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scores read own or staff" ON public.student_scores;
CREATE POLICY "scores read own or staff" ON public.student_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "scores staff write" ON public.student_scores;
CREATE POLICY "scores staff write" ON public.student_scores
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

DROP POLICY IF EXISTS "score history read own or staff" ON public.student_score_history;
CREATE POLICY "score history read own or staff" ON public.student_score_history
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

GRANT SELECT, INSERT, UPDATE ON public.student_scores TO authenticated;
GRANT SELECT ON public.student_score_history TO authenticated;
GRANT ALL ON public.student_scores TO service_role;
GRANT ALL ON public.student_score_history TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.student_score_history FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public.bs_rank_letter(p_total integer)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_total >= 1500 THEN 'S'
    WHEN p_total >= 1400 THEN 'A'
    WHEN p_total >= 1300 THEN 'B'
    WHEN p_total >= 1200 THEN 'C'
    ELSE 'D'
  END;
$$;

REVOKE ALL ON FUNCTION public.bs_rank_letter(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_rank_letter(integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_set_student_score(
  p_user_id uuid,
  p_rw integer,
  p_math integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rw int;
  v_math int;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  v_rw := LEAST(800, GREATEST(200, ROUND(COALESCE(p_rw, 200))::int));
  v_math := LEAST(800, GREATEST(200, ROUND(COALESCE(p_math, 200))::int));
  INSERT INTO public.student_scores (user_id, rw, math, updated_by, updated_at)
  VALUES (p_user_id, v_rw, v_math, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    rw = EXCLUDED.rw,
    math = EXCLUDED.math,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_student_score(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_student_score(uuid, integer, integer) TO authenticated;
