-- A teacher can close a half-hour slot so students cannot take it.
-- Booking or assigning the slot writes a confirmed support session.

ALTER TABLE public.support_windows
  ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;

ALTER TABLE public.support_windows
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.support_sessions(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public._support_can_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text IN ('teacher', 'support_teacher')
    );
$$;

CREATE OR REPLACE FUNCTION public._support_session_for_window(
  p_window_id uuid,
  p_student uuid,
  p_subject public.class_subject
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_id uuid;
BEGIN
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  SELECT teacher_id, starts_at, ends_at
    INTO v_teacher, v_start, v_end
  FROM public.support_windows
  WHERE id = p_window_id;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, status, preferred_on, expires_at
  )
  VALUES (
    p_student,
    v_teacher,
    NULL,
    p_subject,
    v_start,
    v_end,
    'confirmed',
    (v_start AT TIME ZONE 'Asia/Tashkent')::date,
    v_start
  )
  RETURNING id INTO v_id;
  UPDATE public.support_windows
  SET session_id = v_id
  WHERE id = p_window_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_set_support_window_open(p_window_id uuid, p_open boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT teacher_id INTO v_teacher FROM public.support_windows WHERE id = p_window_id;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_teacher = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.support_windows
  SET closed = NOT COALESCE(p_open, false)
  WHERE id = p_window_id;
END;
$$;

DROP FUNCTION IF EXISTS public.staff_assign_support_by_name(uuid, text);
DROP FUNCTION IF EXISTS public.staff_assign_support_window(uuid, uuid);

CREATE OR REPLACE FUNCTION public.staff_assign_support_window(
  p_window_id uuid,
  p_student_id uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_windows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.student_id IS NOT NULL THEN
    RAISE EXCEPTION 'That window is already taken';
  END IF;
  IF v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That window has already started';
  END IF;
  UPDATE public.support_windows
  SET student_id = p_student_id
  WHERE id = p_window_id;
  PERFORM public._support_session_for_window(p_window_id, p_student_id, p_subject);
  PERFORM public._support_notify(
    p_student_id,
    'Support session assigned',
    'A teacher assigned you a support session.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_assign_support_by_name(
  p_window_id uuid,
  p_name text,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_student uuid;
  v_count integer;
BEGIN
  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter the student username';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.profiles p
  WHERE p.username = v_name OR p.id::text = v_name;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'That name matches more than one account';
  END IF;
  SELECT p.id INTO v_student
  FROM public.profiles p
  WHERE p.username = v_name OR p.id::text = v_name;
  PERFORM public.staff_assign_support_window(p_window_id, v_student, p_subject);
END;
$$;

DROP FUNCTION IF EXISTS public.student_book_support_window(uuid);

CREATE OR REPLACE FUNCTION public.student_book_support_window(
  p_window_id uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_windows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_uid AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can book support';
  END IF;
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now()
     OR v_row.starts_at > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'That window is not open for students yet';
  END IF;
  UPDATE public.support_windows
  SET student_id = v_uid
  WHERE id = p_window_id;
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject);
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.support_window_board()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_is_support_staff(v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT w.id, w.teacher_id, w.starts_at, w.ends_at, w.student_id, w.closed,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE(stu.full_name, stu.username) AS student_name
      FROM public.support_windows w
      JOIN public.profiles tea ON tea.id = w.teacher_id
      LEFT JOIN public.profiles stu ON stu.id = w.student_id
      WHERE w.starts_at > now() - interval '1 day'
        AND (public.bs_is_admin() OR w.teacher_id = v_uid)
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_bookable_windows()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT w.id, w.starts_at, w.ends_at,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name
      FROM public.support_windows w
      JOIN public.profiles tea ON tea.id = w.teacher_id
      WHERE w.student_id IS NULL
        AND w.closed = false
        AND w.starts_at > now()
        AND w.starts_at <= now() + interval '24 hours'
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public._support_session_for_window(uuid, uuid, public.class_subject) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.teacher_set_support_window_open(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_assign_support_window(uuid, uuid, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_assign_support_by_name(uuid, text, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_book_support_window(uuid, public.class_subject) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.teacher_set_support_window_open(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_window(uuid, uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_by_name(uuid, text, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_book_support_window(uuid, public.class_subject) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261013000002', 'support_window_open')
ON CONFLICT (version) DO NOTHING;
