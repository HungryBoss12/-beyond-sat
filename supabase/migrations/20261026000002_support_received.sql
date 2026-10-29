-- Students reach a support teacher only after a class teacher or an admin sends them.

CREATE TABLE IF NOT EXISTS public.support_received (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  support_teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_received_one UNIQUE (support_teacher_id, student_id)
);

ALTER TABLE public.support_received ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.support_received TO service_role;
REVOKE ALL ON public.support_received FROM anon, authenticated, PUBLIC;

CREATE OR REPLACE FUNCTION public.support_send_student(
  p_student uuid,
  p_support_teacher uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p_support_teacher AND ur.role::text = 'support_teacher'
  ) THEN
    RAISE EXCEPTION 'Pick a support teacher';
  END IF;
  IF NOT public.bs_is_admin() THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_uid AND ur.role::text = 'teacher'
    ) THEN
      RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM public.class_groups g
      JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
      WHERE g.teacher_id = v_uid AND m.user_id = p_student
    ) THEN
      RAISE EXCEPTION 'That student is not in your groups';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = p_student AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'That student is not in a class';
  END IF;
  INSERT INTO public.support_received (support_teacher_id, student_id, subject, assigned_by)
  VALUES (p_support_teacher, p_student, p_subject, v_uid)
  ON CONFLICT (support_teacher_id, student_id) DO UPDATE
  SET subject = EXCLUDED.subject, assigned_by = EXCLUDED.assigned_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_unsend_student(
  p_student uuid,
  p_support_teacher uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_received%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row
  FROM public.support_received
  WHERE student_id = p_student AND support_teacher_id = p_support_teacher;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'That student was not sent to this support teacher';
  END IF;
  IF NOT public.bs_is_admin() AND v_row.assigned_by IS DISTINCT FROM v_uid THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.class_groups g
      JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
      WHERE g.teacher_id = v_uid AND m.user_id = p_student
    ) THEN
      RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_windows w
    WHERE w.teacher_id = p_support_teacher
      AND w.student_id = p_student
      AND w.starts_at > now()
  ) THEN
    RAISE EXCEPTION 'Clear the upcoming session before taking this student back';
  END IF;
  DELETE FROM public.support_received WHERE id = v_row.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_received_students(p_teacher uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher uuid;
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  v_teacher := CASE
    WHEN public.bs_is_admin() THEN COALESCE(p_teacher, v_uid)
    ELSE v_uid
  END;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT r.student_id AS id,
        COALESCE(p.full_name, p.username, 'Student') AS name,
        r.subject,
        COALESCE((
          SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = r.student_id AND m.status = 'active'
        ), '') AS class_name,
        COALESCE(sender.full_name, sender.username, 'Staff') AS sent_by
      FROM public.support_received r
      JOIN public.profiles p ON p.id = r.student_id
      LEFT JOIN public.profiles sender ON sender.id = r.assigned_by
      WHERE r.support_teacher_id = v_teacher
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_send_board()
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
  IF NOT public.bs_is_admin() AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'teacher'
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'teachers', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.name)
      FROM (
        SELECT DISTINCT p.id, COALESCE(p.full_name, p.username, 'Teacher') AS name
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        WHERE ur.role::text = 'support_teacher'
      ) t
    ), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.name)
      FROM (
        SELECT DISTINCT p.id,
          COALESCE(p.full_name, p.username, 'Student') AS name,
          COALESCE((
            SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
            FROM public.class_group_memberships mm
            JOIN public.class_groups g ON g.id = mm.group_id
            WHERE mm.user_id = p.id AND mm.status = 'active'
              AND (public.bs_is_admin() OR g.teacher_id = v_uid)
          ), '') AS class_name,
          r.support_teacher_id,
          COALESCE(st.full_name, st.username) AS support_teacher_name,
          r.subject
        FROM public.profiles p
        JOIN public.class_group_memberships m ON m.user_id = p.id AND m.status = 'active'
        JOIN public.class_groups g ON g.id = m.group_id
        LEFT JOIN public.support_received r ON r.student_id = p.id
        LEFT JOIN public.profiles st ON st.id = r.support_teacher_id
        WHERE public.bs_is_admin() OR g.teacher_id = v_uid
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

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
  v_subject public.class_subject;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
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
  SELECT subject INTO v_subject
  FROM public.support_received
  WHERE support_teacher_id = v_row.teacher_id AND student_id = p_student_id;
  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'That student has not been sent to this support teacher';
  END IF;
  PERFORM public._support_session_for_window(
    p_window_id, p_student_id, COALESCE(p_subject, v_subject), 'assigned', 'confirmed'
  );
  PERFORM public._support_notify(
    p_student_id,
    'Support session assigned',
    'A teacher assigned you a support session.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.support_clear_window(p_window_id uuid)
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
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That session has already started';
  END IF;
  IF v_row.session_id IS NOT NULL THEN
    UPDATE public.support_sessions
    SET status = 'rejected', rejection_reason = 'Session cleared'
    WHERE id = v_row.session_id AND status IN ('pending', 'confirmed');
    PERFORM public._support_release_window(v_row.session_id);
  ELSE
    UPDATE public.support_windows SET student_id = NULL WHERE id = p_window_id;
  END IF;
END;
$$;

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
  PERFORM public.support_prepare_windows(14);
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That slot is already taken';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.support_received r
    WHERE r.support_teacher_id = v_row.teacher_id AND r.student_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Ask your teacher to send you to this support teacher first';
  END IF;
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'confirmed');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.support_send_student(uuid, uuid, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_unsend_student(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_received_students(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_send_board() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_clear_window(uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.support_send_student(uuid, uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_unsend_student(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_received_students(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_send_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_clear_window(uuid) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026000002', 'support_received')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
