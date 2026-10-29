-- Each support teacher teaches English or Math. Charts, setup, and assignment follow that.

CREATE TABLE IF NOT EXISTS public.support_subjects (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL
);

ALTER TABLE public.support_subjects ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.support_subjects TO service_role;
REVOKE ALL ON public.support_subjects FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "support subjects admin" ON public.support_subjects;
CREATE POLICY "support subjects admin" ON public.support_subjects
  FOR ALL TO authenticated
  USING (public.bs_is_admin())
  WITH CHECK (public.bs_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_subjects TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_support_subject(
  p_teacher uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_teacher AND role::text = 'support_teacher'
  ) THEN
    RAISE EXCEPTION 'That user is not a support teacher';
  END IF;
  INSERT INTO public.support_subjects (teacher_id, subject)
  VALUES (p_teacher, p_subject)
  ON CONFLICT (teacher_id) DO UPDATE SET subject = EXCLUDED.subject;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_my_subject()
RETURNS public.class_subject
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT subject FROM public.support_subjects WHERE teacher_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public._support_require_subject(
  p_teacher uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_have public.class_subject;
BEGIN
  SELECT subject INTO v_have FROM public.support_subjects WHERE teacher_id = p_teacher;
  IF v_have IS NULL THEN
    RAISE EXCEPTION 'That support teacher has no subject yet';
  END IF;
  IF v_have IS DISTINCT FROM p_subject THEN
    RAISE EXCEPTION 'That teacher does not teach this subject';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_support_subject(uuid, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_my_subject() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._support_require_subject(uuid, public.class_subject) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_support_subject(uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_my_subject() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_support_teachers()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT p.id,
        COALESCE(p.full_name, p.username, 'Teacher') AS name,
        public._support_teacher_status(p.id) AS status,
        ss.subject,
        d.ends_at AS duty_ends_at,
        (
          SELECT count(*) FROM public.support_sessions s
          WHERE s.teacher_id = p.id AND s.status = 'completed'
        ) AS done_count,
        (
          SELECT count(*) FROM public.support_sessions s
          WHERE s.teacher_id = p.id AND s.status IN ('pending', 'confirmed') AND s.ends_at >= now()
        ) AS planned_count
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role::text = 'support_teacher'
      LEFT JOIN public.support_duty d ON d.teacher_id = p.id
      LEFT JOIN public.support_subjects ss ON ss.teacher_id = p.id
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
  v_admin boolean;
  v_class boolean;
  v_support boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  v_admin := public.bs_is_admin();
  v_class := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'teacher'
  );
  v_support := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'support_teacher'
  );
  IF NOT (v_admin OR v_class OR v_support) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'teachers', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.name)
      FROM (
        SELECT DISTINCT p.id,
          COALESCE(p.full_name, p.username, 'Teacher') AS name,
          ss.subject
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        LEFT JOIN public.support_subjects ss ON ss.teacher_id = p.id
        WHERE ur.role::text = 'support_teacher'
          AND (NOT v_support OR v_admin OR v_class OR p.id = v_uid)
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
              AND (v_admin OR g.teacher_id = v_uid OR v_support)
          ), '') AS class_name,
          r.support_teacher_id,
          COALESCE(st.full_name, st.username) AS support_teacher_name,
          r.subject
        FROM public.profiles p
        JOIN public.class_group_memberships m ON m.user_id = p.id AND m.status = 'active'
        JOIN public.class_groups g ON g.id = m.group_id
        LEFT JOIN public.support_received r ON r.student_id = p.id
          AND (NOT (v_support AND NOT v_admin AND NOT v_class) OR r.support_teacher_id = v_uid)
        LEFT JOIN public.profiles st ON st.id = r.support_teacher_id
        WHERE v_admin
          OR g.teacher_id = v_uid
          OR (v_support AND r.support_teacher_id = v_uid)
      ) s
    ), '[]'::jsonb)
  );
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
  v_day date;
  v_session uuid;
  v_name text;
  v_when text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public.support_booking_on() THEN
    RAISE EXCEPTION 'Student booking is turned off';
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
  PERFORM public.support_prepare_windows(14);
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That slot is already taken';
  END IF;
  PERFORM public._support_require_subject(v_row.teacher_id, p_subject);
  v_day := (v_row.starts_at AT TIME ZONE 'Asia/Tashkent')::date;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(v_day::text));
  IF EXISTS (
    SELECT 1
    FROM public.support_sessions s
    WHERE s.student_id = v_uid
      AND s.status IN ('pending', 'confirmed')
      AND COALESCE(s.preferred_on, (s.starts_at AT TIME ZONE 'Asia/Tashkent')::date) = v_day
  ) THEN
    RAISE EXCEPTION 'You already have support that day';
  END IF;
  v_session := public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'confirmed');
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'A student') INTO v_name
  FROM public.profiles WHERE id = v_uid;
  v_when := to_char(v_row.starts_at AT TIME ZONE 'Asia/Tashkent', 'Dy FMDD Mon, HH24:MI');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    v_name || ' booked ' || v_when || '.',
    '/admin/support',
    v_session
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
  v_in_group boolean;
  v_session uuid;
  v_when text;
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
  v_in_group := EXISTS (
    SELECT 1
    FROM public.class_groups g
    JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
    WHERE g.teacher_id = v_uid AND m.user_id = p_student_id
  );
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid OR v_in_group) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.student_id IS NOT NULL THEN
    RAISE EXCEPTION 'That window is already taken';
  END IF;
  IF v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That window has already started';
  END IF;
  PERFORM public._support_require_subject(v_row.teacher_id, p_subject);
  SELECT subject INTO v_subject
  FROM public.support_received
  WHERE support_teacher_id = v_row.teacher_id AND student_id = p_student_id;
  IF v_row.teacher_id = v_uid AND NOT public.bs_is_admin() AND v_subject IS NULL THEN
    RAISE EXCEPTION 'That student has not been sent to this support teacher';
  END IF;
  v_session := public._support_session_for_window(
    p_window_id, p_student_id, p_subject, 'assigned', 'confirmed'
  );
  v_when := to_char(v_row.starts_at AT TIME ZONE 'Asia/Tashkent', 'Dy FMDD Mon, HH24:MI');
  PERFORM public._support_notify(
    p_student_id,
    'Support session assigned',
    'A teacher assigned you a support session on ' || v_when || '.',
    '/support-lessons',
    v_session
  );
END;
$$;

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS starting_notified_at timestamptz;

CREATE OR REPLACE FUNCTION public.support_notify_starting_soon()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_sessions%ROWTYPE;
  v_when text;
  v_label text;
  v_count integer := 0;
BEGIN
  FOR v_row IN
    SELECT *
    FROM public.support_sessions
    WHERE status = 'confirmed'
      AND starting_notified_at IS NULL
      AND starts_at > now()
      AND starts_at <= now() + interval '5 minutes'
    FOR UPDATE SKIP LOCKED
  LOOP
    v_when := to_char(v_row.starts_at AT TIME ZONE 'Asia/Tashkent', 'HH24:MI');
    v_label := CASE WHEN v_row.subject = 'math' THEN 'Math' ELSE 'English' END;
    PERFORM public._support_notify(
      v_row.student_id,
      'Support lesson starting',
      'Your ' || v_label || ' support lesson starts in 5 minutes, at ' || v_when || '.',
      '/support-lessons',
      v_row.id
    );
    UPDATE public.support_sessions
    SET starting_notified_at = now()
    WHERE id = v_row.id;
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.support_notify_starting_soon() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.support_notify_starting_soon() TO service_role;

CREATE OR REPLACE FUNCTION public.support_teacher_directory()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT DISTINCT p.id,
        COALESCE(p.full_name, p.username, 'Teacher') AS name,
        ss.subject
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.support_subjects ss ON ss.teacher_id = p.id
      WHERE ur.role::text = 'support_teacher'
    ) x
  ), '[]'::jsonb);
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261030000001', 'support_subject')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
