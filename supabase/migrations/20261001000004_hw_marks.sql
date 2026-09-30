-- Per-lesson homework marks for both schemes: VAR (Eng) and AFL (Maths).

DO $$ BEGIN
  CREATE TYPE public.hw_item AS ENUM ('vocab', 'assignment', 'article', 'formulas');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.bs_scheme_items(p_subject public.class_subject)
RETURNS public.hw_item[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_subject
    WHEN 'math' THEN ARRAY['assignment', 'formulas']::public.hw_item[]
    ELSE ARRAY['vocab', 'assignment', 'article']::public.hw_item[]
  END;
$$;

REVOKE ALL ON FUNCTION public.bs_scheme_items(public.class_subject) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_scheme_items(public.class_subject) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.lesson_hw_marks (
  lesson_id uuid NOT NULL REFERENCES public.class_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item public.hw_item NOT NULL,
  group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  done boolean NOT NULL DEFAULT false,
  source public.var_source NOT NULL DEFAULT 'manual',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, user_id, item)
);

CREATE INDEX IF NOT EXISTS lesson_hw_marks_group_idx ON public.lesson_hw_marks (group_id, user_id);

CREATE OR REPLACE FUNCTION public.lesson_hw_marks_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_subject public.class_subject;
BEGIN
  SELECT l.group_id, l.subject INTO v_group, v_subject
  FROM public.class_lessons l WHERE l.id = NEW.lesson_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (NEW.item = ANY (public.bs_scheme_items(v_subject))) THEN
    RAISE EXCEPTION '% is not part of the % scheme', NEW.item, public.bs_group_scheme(v_subject);
  END IF;
  NEW.group_id := v_group;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lesson_hw_marks_check ON public.lesson_hw_marks;
CREATE TRIGGER lesson_hw_marks_check
  BEFORE INSERT OR UPDATE ON public.lesson_hw_marks
  FOR EACH ROW EXECUTE FUNCTION public.lesson_hw_marks_check();

-- Move the (empty) v1 table, then replace it with a read-only view of the same shape.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'lesson_var_marks' AND c.relkind = 'r'
  ) THEN
    INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
    SELECT v.lesson_id, v.user_id, x.item, l.group_id, x.done, COALESCE(x.src, 'manual'), v.updated_by, v.updated_at
    FROM public.lesson_var_marks v
    JOIN public.class_lessons l ON l.id = v.lesson_id
    CROSS JOIN LATERAL (VALUES
      ('vocab'::public.hw_item, v.vocab, v.vocab_source),
      ('assignment'::public.hw_item, v.assignment, v.assignment_source),
      ('article'::public.hw_item, v.article, v.article_source)
    ) AS x(item, done, src)
    WHERE x.done OR x.src IS NOT NULL
    ON CONFLICT DO NOTHING;
    DROP TABLE public.lesson_var_marks;
  END IF;
END $$;

CREATE OR REPLACE VIEW public.lesson_var_marks
WITH (security_invoker = true) AS
SELECT
  l.class_id,
  m.lesson_id,
  m.user_id,
  COALESCE(bool_or(m.done) FILTER (WHERE m.item = 'vocab'), false) AS vocab,
  COALESCE(bool_or(m.done) FILTER (WHERE m.item = 'assignment'), false) AS assignment,
  COALESCE(bool_or(m.done) FILTER (WHERE m.item = 'article'), false) AS article,
  max(m.source::text) FILTER (WHERE m.item = 'vocab')::public.var_source AS vocab_source,
  max(m.source::text) FILTER (WHERE m.item = 'assignment')::public.var_source AS assignment_source,
  max(m.source::text) FILTER (WHERE m.item = 'article')::public.var_source AS article_source,
  max(m.updated_by::text)::uuid AS updated_by,
  max(m.updated_at) AS updated_at
FROM public.lesson_hw_marks m
JOIN public.class_lessons l ON l.id = m.lesson_id
GROUP BY l.class_id, m.lesson_id, m.user_id;

COMMENT ON VIEW public.lesson_var_marks IS 'Deprecated read-only view over lesson_hw_marks. Dropped in the v2 cleanup step.';

GRANT SELECT ON public.lesson_var_marks TO authenticated;

ALTER TABLE public.lesson_hw_marks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "hw marks read own or staff" ON public.lesson_hw_marks;
CREATE POLICY "hw marks read own or staff" ON public.lesson_hw_marks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "hw marks staff write" ON public.lesson_hw_marks;
CREATE POLICY "hw marks staff write" ON public.lesson_hw_marks
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_hw_marks TO authenticated;
REVOKE ALL ON public.lesson_hw_marks FROM anon, PUBLIC;
GRANT ALL ON public.lesson_hw_marks TO service_role;

-- Homework kinds follow the same scheme.
ALTER TABLE public.homework_assignments
  ALTER COLUMN var_kind TYPE public.hw_item USING var_kind::text::public.hw_item;

CREATE OR REPLACE FUNCTION public.homework_assignments_scheme_check()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.var_kind IS NOT NULL AND NOT (NEW.var_kind = ANY (public.bs_scheme_items(NEW.subject))) THEN
    RAISE EXCEPTION '% is not part of the % scheme', NEW.var_kind, public.bs_group_scheme(NEW.subject);
  END IF;
  RETURN NEW;
END;
$$;

-- Runs after homework_assignments_fill_group (alphabetical), so subject is set.
DROP TRIGGER IF EXISTS homework_assignments_scheme_check ON public.homework_assignments;
CREATE TRIGGER homework_assignments_scheme_check
  BEFORE INSERT OR UPDATE ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.homework_assignments_scheme_check();

CREATE OR REPLACE FUNCTION public.bs_var_autotick(
  p_lesson_id uuid,
  p_user_id uuid,
  p_flag text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject public.class_subject;
  v_item public.hw_item;
BEGIN
  IF p_flag NOT IN ('vocab', 'assignment', 'article', 'formulas') THEN
    RETURN;
  END IF;
  v_item := p_flag::public.hw_item;
  SELECT subject INTO v_subject FROM public.class_lessons WHERE id = p_lesson_id;
  IF v_subject IS NULL OR NOT (v_item = ANY (public.bs_scheme_items(v_subject))) THEN
    RETURN;
  END IF;
  INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_at)
  SELECT p_lesson_id, p_user_id, v_item, l.group_id, true, 'auto', now()
  FROM public.class_lessons l WHERE l.id = p_lesson_id
  ON CONFLICT (lesson_id, user_id, item) DO UPDATE
    SET done = true, source = 'auto', updated_at = now()
    WHERE lesson_hw_marks.source <> 'manual';
END;
$$;

CREATE OR REPLACE FUNCTION public.homework_submissions_autotick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.hw_item;
  v_lesson uuid;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT a.var_kind, a.lesson_id INTO v_kind, v_lesson
    FROM public.homework_assignments a
    WHERE a.id = NEW.assignment_id;
    IF v_kind IS NOT NULL AND v_lesson IS NOT NULL THEN
      PERFORM public.bs_var_autotick(v_lesson, NEW.student_id, v_kind::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Tick / untick RPCs -----------------------------------------------------------

CREATE OR REPLACE FUNCTION public._bs_live_members(p_group_id uuid, p_user_ids uuid[])
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.user_id FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.status <> 'left'
    AND m.user_id = ANY (COALESCE(p_user_ids, ARRAY[]::uuid[]));
$$;

REVOKE ALL ON FUNCTION public._bs_live_members(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

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
  FOR v_uid IN SELECT * FROM public._bs_live_members(v_lesson.group_id, p_user_ids) LOOP
    PERFORM public._bs_set_group_attendance(v_lesson.group_id, v_uid, v_lesson.lesson_date, 'present');
    INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
    SELECT p_lesson_id, v_uid, i, v_lesson.group_id, true, 'manual', auth.uid(), now()
    FROM unnest(public.bs_scheme_items(v_lesson.subject)) AS i
    ON CONFLICT (lesson_id, user_id, item) DO UPDATE
      SET done = true, source = 'manual', updated_by = auth.uid(), updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.untick_all(p_lesson_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
  SELECT p_lesson_id, u, i, v_lesson.group_id, false, 'manual', auth.uid(), now()
  FROM public._bs_live_members(v_lesson.group_id, p_user_ids) AS u
  CROSS JOIN unnest(public.bs_scheme_items(v_lesson.subject)) AS i
  ON CONFLICT (lesson_id, user_id, item) DO UPDATE
    SET done = false, source = 'manual', updated_by = auth.uid(), updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_hw_marks(
  p_lesson_id uuid,
  p_user_ids uuid[],
  p_item public.hw_item,
  p_done boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
  v_count int;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
  SELECT p_lesson_id, u, p_item, v_lesson.group_id, COALESCE(p_done, false), 'manual', auth.uid(), now()
  FROM public._bs_live_members(v_lesson.group_id, p_user_ids) AS u
  ON CONFLICT (lesson_id, user_id, item) DO UPDATE
    SET done = EXCLUDED.done, source = 'manual', updated_by = auth.uid(), updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.untick_all(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_set_hw_marks(uuid, uuid[], public.hw_item, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.untick_all(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_set_hw_marks(uuid, uuid[], public.hw_item, boolean) TO authenticated;
