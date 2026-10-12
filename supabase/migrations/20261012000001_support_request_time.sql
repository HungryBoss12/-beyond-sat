-- A support request carries the student's chosen start. It has to fall on the
-- picked Tashkent day and finish inside center hours.

DROP FUNCTION IF EXISTS public.student_request_support(public.class_subject, text, date);

CREATE OR REPLACE FUNCTION public.student_request_support(
  p_subject public.class_subject,
  p_notes text,
  p_day date,
  p_start timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_subject text;
  v_teachers uuid[];
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF p_day IS NULL OR p_day < (now() AT TIME ZONE 'Asia/Tashkent')::date THEN
    RAISE EXCEPTION 'Pick today or a later date';
  END IF;
  IF p_start IS NULL THEN
    RAISE EXCEPTION 'Pick a time during center hours';
  END IF;
  IF (p_start AT TIME ZONE 'Asia/Tashkent')::date IS DISTINCT FROM p_day THEN
    RAISE EXCEPTION 'That time is not on the chosen day';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_student AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can request support';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.student_id = v_student AND s.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request';
  END IF;
  PERFORM public._support_check_lesson_time(p_start, v_student, NULL);

  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, notes, preferred_on, expires_at
  )
  VALUES (
    v_student, NULL, NULL, p_subject, p_start, p_start + interval '1 hour',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_day,
    now() + interval '2 days'
  )
  RETURNING id INTO v_id;

  SELECT COALESCE(full_name, username, 'A student') INTO v_name
  FROM public.profiles WHERE id = v_student;
  v_subject := CASE WHEN p_subject = 'math' THEN 'Math' ELSE 'English' END;
  SELECT COALESCE(array_agg(DISTINCT ur.user_id), ARRAY[]::uuid[]) INTO v_teachers
  FROM public.user_roles ur
  WHERE ur.role = 'teacher';
  PERFORM public._support_notify_users(
    v_teachers,
    'New support request',
    v_name || ' asked for ' || v_subject || ' on '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.',
    '/admin/support'
  );
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_request_support(public.class_subject, text, date, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_request_support(public.class_subject, text, date, timestamptz) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000001', 'support_request_time')
ON CONFLICT (version) DO NOTHING;
