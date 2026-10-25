-- An absent student is not auto-ticked. Marks a teacher set by hand stay.
-- Marking someone absent clears only the automatic circles for that lesson.

CREATE OR REPLACE FUNCTION public._bs_set_group_attendance(
  p_group_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_state NOT IN ('present', 'absent', 'empty') THEN
    RAISE EXCEPTION 'Attendance state must be present, absent, or empty';
  END IF;
  IF p_state = 'empty' THEN
    DELETE FROM public.lesson_attendance
    WHERE group_id = p_group_id AND user_id = p_user_id AND lesson_date = p_lesson_date;
    RETURN;
  END IF;
  INSERT INTO public.lesson_attendance (group_id, user_id, lesson_date, participated, marked_by)
  VALUES (p_group_id, p_user_id, p_lesson_date, p_state = 'present', auth.uid())
  ON CONFLICT (group_id, user_id, lesson_date)
  DO UPDATE SET participated = EXCLUDED.participated, marked_by = EXCLUDED.marked_by;
  IF p_state = 'absent' THEN
    UPDATE public.lesson_hw_marks m
    SET done = false, updated_at = now()
    FROM public.class_lessons l
    WHERE m.lesson_id = l.id
      AND l.group_id = p_group_id
      AND l.lesson_date = p_lesson_date
      AND m.user_id = p_user_id
      AND m.source = 'auto'
      AND m.done = true;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._bs_student_absent(p_lesson_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_lessons l
    JOIN public.lesson_attendance a
      ON a.group_id = l.group_id
     AND a.lesson_date = l.lesson_date
     AND a.user_id = p_user_id
     AND a.participated = false
    WHERE l.id = p_lesson_id
  );
$$;

REVOKE ALL ON FUNCTION public._bs_student_absent(uuid, uuid) FROM PUBLIC, anon, authenticated;

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
  IF public._bs_student_absent(p_lesson_id, p_user_id) THEN
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
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_lesson.group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  FOR v_uid IN SELECT * FROM public._bs_live_members(v_lesson.group_id, p_user_ids) LOOP
    IF public._bs_student_absent(p_lesson_id, v_uid) THEN
      CONTINUE;
    END IF;
    PERFORM public._bs_set_group_attendance(v_lesson.group_id, v_uid, v_lesson.lesson_date, 'present');
    INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
    SELECT p_lesson_id, v_uid, i, v_lesson.group_id, true, 'manual', auth.uid(), now()
    FROM unnest(public.bs_scheme_items(v_lesson.subject)) AS i
    ON CONFLICT (lesson_id, user_id, item) DO UPDATE
      SET done = true, source = 'manual', updated_by = auth.uid(), updated_at = now();
  END LOOP;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261022000003', 'absent_skips_autotick')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
