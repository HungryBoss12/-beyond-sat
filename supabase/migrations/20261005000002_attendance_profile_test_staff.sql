-- Tick a whole attendance column, let admins edit a student profile,
-- and let editors write tests.

CREATE OR REPLACE FUNCTION public.set_group_attendance_many(
  p_group_id uuid,
  p_user_ids uuid[],
  p_lesson_date date,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  FOREACH v_user IN ARRAY COALESCE(p_user_ids, '{}'::uuid[])
  LOOP
    PERFORM public._bs_set_group_attendance(p_group_id, v_user, p_lesson_date, p_state);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_attendance_many(uuid, uuid[], date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_attendance_many(uuid, uuid[], date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_update_student_profile(
  p_user_id uuid,
  p_full_name text,
  p_description text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(coalesce(p_full_name, ''));
  v_first text;
  v_last text;
  v_notes text := nullif(btrim(coalesce(p_description, '')), '');
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF char_length(v_name) < 2 THEN
    RAISE EXCEPTION 'Enter the student''s name.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  v_first := split_part(v_name, ' ', 1);
  v_last := nullif(btrim(substr(v_name, char_length(v_first) + 1)), '');

  UPDATE public.profiles
  SET full_name = v_name,
      first_name = v_first,
      last_name = v_last
  WHERE id = p_user_id;

  INSERT INTO public.students (full_name, user_id, description, created_by)
  VALUES (v_name, p_user_id, v_notes, auth.uid())
  ON CONFLICT (user_id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      description = EXCLUDED.description;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_student_profile(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_student_profile(uuid, text, text) TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.tests TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.test_questions TO authenticated;

DROP POLICY IF EXISTS "staff write tests" ON public.tests;
CREATE POLICY "staff write tests" ON public.tests
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

DROP POLICY IF EXISTS "staff write test questions" ON public.test_questions;
CREATE POLICY "staff write test questions" ON public.test_questions
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261005000002', 'attendance_profile_test_staff')
ON CONFLICT (version) DO NOTHING;
