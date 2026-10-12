-- A claimed or rescheduled support lesson must sit inside center hours and
-- off both the student's and the teacher's class.

CREATE OR REPLACE FUNCTION public._support_check_lesson_time(
  p_start timestamptz,
  p_student uuid,
  p_teacher uuid
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end timestamptz := p_start + interval '1 hour';
BEGIN
  IF p_start IS NULL THEN
    RETURN;
  END IF;
  IF p_start <= now() THEN
    RAISE EXCEPTION 'Pick a later time';
  END IF;
  PERFORM public._support_within_hours(p_start, v_end);
  IF p_student IS NOT NULL AND public._support_overlaps_class(p_student, p_start, v_end, false) THEN
    RAISE EXCEPTION 'That overlaps the student''s class';
  END IF;
  IF p_teacher IS NOT NULL AND public._support_overlaps_class(p_teacher, p_start, v_end, true) THEN
    RAISE EXCEPTION 'That overlaps the teacher''s class';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_claim_support(
  p_session_id uuid,
  p_start timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.support_sessions%ROWTYPE;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public._support_expire_requests();

  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_row.status <> 'pending' OR v_row.expires_at <= now() THEN
    RAISE EXCEPTION 'That request is no longer open';
  END IF;
  IF v_row.teacher_id IS NOT NULL AND v_row.teacher_id <> v_uid THEN
    RAISE EXCEPTION 'That request is no longer open';
  END IF;
  PERFORM public._support_check_lesson_time(p_start, v_row.student_id, v_uid);

  UPDATE public.support_sessions
  SET teacher_id = v_uid,
      status = 'confirmed',
      starts_at = p_start,
      ends_at = CASE WHEN p_start IS NULL THEN NULL ELSE p_start + interval '1 hour' END
  WHERE id = p_session_id;

  SELECT COALESCE(full_name, username, 'A teacher') INTO v_name
  FROM public.profiles WHERE id = v_uid;
  v_body := v_name || ' claimed your '
    || CASE WHEN v_row.subject = 'math' THEN 'Math' ELSE 'English' END
    || ' request.';
  IF p_start IS NOT NULL THEN
    v_body := v_body || ' It starts '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.';
  END IF;
  PERFORM public._support_notify(v_row.student_id, 'Support request claimed', v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_set_start(
  p_session_id uuid,
  p_start timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_sessions%ROWTYPE;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_row.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Set a time after the request is claimed';
  END IF;
  IF NOT (
    public.bs_is_admin()
    OR v_row.student_id = v_uid
    OR v_row.teacher_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public._support_check_lesson_time(p_start, v_row.student_id, v_row.teacher_id);

  UPDATE public.support_sessions
  SET starts_at = p_start,
      ends_at = CASE WHEN p_start IS NULL THEN NULL ELSE p_start + interval '1 hour' END
  WHERE id = p_session_id;

  IF p_start IS NULL THEN
    v_body := 'The start time was cleared.';
  ELSE
    v_body := 'The lesson starts '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.';
  END IF;

  IF v_uid = v_row.student_id THEN
    IF v_row.teacher_id IS NOT NULL THEN
      PERFORM public._support_notify(v_row.teacher_id, 'Support time updated', v_body, '/admin/support');
    END IF;
  ELSIF v_uid = v_row.teacher_id THEN
    PERFORM public._support_notify(v_row.student_id, 'Support time updated', v_body);
  ELSE
    PERFORM public._support_notify(v_row.student_id, 'Support time updated', v_body);
    IF v_row.teacher_id IS NOT NULL THEN
      PERFORM public._support_notify(v_row.teacher_id, 'Support time updated', v_body, '/admin/support');
    END IF;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._support_check_lesson_time(timestamptz, uuid, uuid) FROM PUBLIC, anon, authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261011000005', 'support_lesson_time_checks')
ON CONFLICT (version) DO NOTHING;
