-- By-request sessions stay pending until the teacher confirms or declines.
-- Assigned sessions are confirmed immediately. A break of at most two hours
-- cancels sessions in that window and tells the students. The admin sets how
-- long each support teacher is on duty today.

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'request';

ALTER TABLE public.support_sessions
  DROP CONSTRAINT IF EXISTS support_sessions_origin;
ALTER TABLE public.support_sessions
  ADD CONSTRAINT support_sessions_origin CHECK (origin IN ('request', 'assigned'));

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS attended boolean;

CREATE TABLE IF NOT EXISTS public.support_breaks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  CONSTRAINT support_breaks_length CHECK (
    ends_at > starts_at AND ends_at <= starts_at + interval '2 hours'
  )
);

CREATE INDEX IF NOT EXISTS support_breaks_teacher_idx
  ON public.support_breaks (teacher_id, starts_at);

CREATE TABLE IF NOT EXISTS public.support_duty (
  teacher_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ends_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_breaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_duty ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.support_breaks TO authenticated;
GRANT SELECT ON public.support_duty TO authenticated;
GRANT ALL ON public.support_breaks TO service_role;
GRANT ALL ON public.support_duty TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.support_breaks FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_duty FROM authenticated, anon, PUBLIC;

DROP POLICY IF EXISTS "support breaks read" ON public.support_breaks;
CREATE POLICY "support breaks read" ON public.support_breaks
  FOR SELECT TO authenticated
  USING (public.bs_is_admin() OR teacher_id = auth.uid());

DROP POLICY IF EXISTS "support duty read" ON public.support_duty;
CREATE POLICY "support duty read" ON public.support_duty
  FOR SELECT TO authenticated
  USING (true);

CREATE OR REPLACE FUNCTION public._support_release_window(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.support_windows
  SET student_id = NULL, session_id = NULL
  WHERE session_id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public._support_release_window(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._support_on_break(
  p_teacher uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.support_breaks b
    WHERE b.teacher_id = p_teacher
      AND b.starts_at < p_end
      AND b.ends_at > p_start
  );
$$;

REVOKE ALL ON FUNCTION public._support_on_break(uuid, timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public._support_session_for_window(uuid, uuid, public.class_subject) CASCADE;

CREATE OR REPLACE FUNCTION public._support_session_for_window(
  p_window_id uuid,
  p_student uuid,
  p_subject public.class_subject,
  p_origin text,
  p_status text
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
  IF p_origin NOT IN ('request', 'assigned') OR p_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'That session cannot be opened';
  END IF;
  SELECT teacher_id, starts_at, ends_at
    INTO v_teacher, v_start, v_end
  FROM public.support_windows
  WHERE id = p_window_id;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF public._support_on_break(v_teacher, v_start, v_end) THEN
    RAISE EXCEPTION 'That teacher is on a break';
  END IF;
  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, status, origin,
    preferred_on, expires_at
  )
  VALUES (
    p_student, v_teacher, NULL, p_subject, v_start, v_end, p_status, p_origin,
    (v_start AT TIME ZONE 'Asia/Tashkent')::date,
    v_start
  )
  RETURNING id INTO v_id;
  UPDATE public.support_windows
  SET student_id = p_student, session_id = v_id
  WHERE id = p_window_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._support_session_for_window(uuid, uuid, public.class_subject, text, text) FROM PUBLIC, anon, authenticated;

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
  IF v_row.id IS NULL OR v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That window is not open';
  END IF;
  IF public._support_on_break(v_row.teacher_id, v_row.starts_at, v_row.ends_at) THEN
    RAISE EXCEPTION 'That teacher is on a break';
  END IF;
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'pending');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support request',
    'A student asked for one of your open sessions.',
    '/admin/support'
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
  PERFORM public._support_session_for_window(p_window_id, p_student_id, p_subject, 'assigned', 'confirmed');
  PERFORM public._support_notify(
    p_student_id,
    'Support session assigned',
    'A teacher assigned you a support session. Please attend.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_confirm_support(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'That request is no longer pending';
  END IF;
  UPDATE public.support_sessions SET status = 'confirmed' WHERE id = p_session_id;
  PERFORM public._support_notify(
    v_row.student_id,
    'Support session confirmed',
    'Your support request was confirmed. Please attend.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_set_support_attendance(
  p_session_id uuid,
  p_present boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.status NOT IN ('confirmed', 'completed') THEN
    RAISE EXCEPTION 'Attendance is for a confirmed session';
  END IF;
  UPDATE public.support_sessions
  SET attended = p_present
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_start_support_break(p_minutes integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_end timestamptz;
  v_row public.support_sessions%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_minutes IS NULL OR p_minutes < 1 OR p_minutes > 120 THEN
    RAISE EXCEPTION 'A break is at most 2 hours';
  END IF;
  v_end := now() + make_interval(mins => p_minutes);
  INSERT INTO public.support_breaks (teacher_id, starts_at, ends_at)
  VALUES (v_uid, now(), v_end);
  FOR v_row IN
    SELECT * FROM public.support_sessions
    WHERE teacher_id = v_uid
      AND status IN ('pending', 'confirmed')
      AND starts_at < v_end
      AND ends_at > now()
    FOR UPDATE
  LOOP
    UPDATE public.support_sessions
    SET status = 'rejected',
        rejection_reason = 'The teacher is on a break'
    WHERE id = v_row.id;
    PERFORM public._support_release_window(v_row.id);
    PERFORM public._support_notify(
      v_row.student_id,
      'Support session declined',
      'Your support session was cancelled because the teacher is on a break.'
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_support_duty(
  p_teacher uuid,
  p_minutes integer
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
  IF p_teacher IS NULL OR p_minutes IS NULL OR p_minutes < 15 OR p_minutes > 14 * 60 THEN
    RAISE EXCEPTION 'Pick a duty length for today';
  END IF;
  INSERT INTO public.support_duty (teacher_id, ends_at)
  VALUES (p_teacher, now() + make_interval(mins => p_minutes))
  ON CONFLICT (teacher_id) DO UPDATE
    SET ends_at = EXCLUDED.ends_at, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public._support_teacher_status(p_teacher uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT EXISTS (
      SELECT 1 FROM public.support_duty d
      WHERE d.teacher_id = p_teacher AND d.ends_at > now()
    ) THEN 'off'
    WHEN EXISTS (
      SELECT 1 FROM public.support_breaks b
      WHERE b.teacher_id = p_teacher AND b.starts_at <= now() AND b.ends_at > now()
    ) THEN 'break'
    WHEN EXISTS (
      SELECT 1 FROM public.support_sessions s
      WHERE s.teacher_id = p_teacher
        AND s.status = 'confirmed'
        AND s.starts_at <= now()
        AND s.ends_at > now()
    ) THEN 'teaching'
    ELSE 'duty'
  END;
$$;

REVOKE ALL ON FUNCTION public._support_teacher_status(uuid) FROM PUBLIC, anon, authenticated;

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
        COALESCE(p.full_name, p.username, 'Teacher') AS name
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      WHERE ur.role::text = 'support_teacher'
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_teacher_slots(p_teacher uuid)
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
        CASE
          WHEN public._support_on_break(w.teacher_id, w.starts_at, w.ends_at) THEN 'break'
          WHEN w.student_id IS NULL THEN 'free'
          WHEN w.student_id = v_uid THEN 'mine'
          ELSE 'taken'
        END AS state
      FROM public.support_windows w
      WHERE w.teacher_id = p_teacher
        AND w.closed = false
        AND w.starts_at > now() - interval '12 hours'
        AND w.starts_at < now() + interval '21 days'
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_coming()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT s.id, s.starts_at, s.ends_at, s.origin, s.attended, s.subject,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE((
          SELECT string_agg(g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = s.student_id AND m.status <> 'left'
        ), '') AS groups
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      WHERE s.status = 'confirmed'
        AND s.ends_at >= now() - interval '12 hours'
        AND (public.bs_is_admin() OR s.teacher_id = v_uid)
    ) x
  ), '[]'::jsonb);
END;
$$;

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
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_support_teacher_detail(p_teacher uuid)
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
  RETURN jsonb_build_object(
    'done', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at DESC)
      FROM (
        SELECT s.id, s.starts_at, s.ends_at, s.origin, s.attended,
          COALESCE(stu.full_name, stu.username, 'Student') AS student_name
        FROM public.support_sessions s
        JOIN public.profiles stu ON stu.id = s.student_id
        WHERE s.teacher_id = p_teacher AND s.status = 'completed'
      ) x
    ), '[]'::jsonb),
    'planned', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
      FROM (
        SELECT s.id, s.starts_at, s.ends_at, s.origin, s.status,
          COALESCE(stu.full_name, stu.username, 'Student') AS student_name
        FROM public.support_sessions s
        JOIN public.profiles stu ON stu.id = s.student_id
        WHERE s.teacher_id = p_teacher
          AND s.status IN ('pending', 'confirmed')
          AND s.ends_at >= now()
      ) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_support_day(p_day date)
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
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT s.id, s.starts_at, s.ends_at, s.origin, s.status,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name
      FROM public.support_sessions s
      LEFT JOIN public.profiles tea ON tea.id = s.teacher_id
      JOIN public.profiles stu ON stu.id = s.student_id
      WHERE (s.starts_at AT TIME ZONE 'Asia/Tashkent')::date = p_day
        AND s.status IN ('pending', 'confirmed', 'completed')
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_my_sessions()
RETURNS jsonb
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
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at NULLS LAST)
    FROM (
      SELECT s.id, s.teacher_id, s.origin, s.status, s.subject, s.starts_at, s.ends_at,
        s.rejection_reason,
        COALESCE(p.full_name, p.username, 'Teacher') AS teacher_name
      FROM public.support_sessions s
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.student_id = v_uid
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_staff_sessions()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at NULLS LAST)
    FROM (
      SELECT s.id, s.student_id, s.teacher_id, s.origin, s.status, s.subject,
        s.starts_at, s.ends_at, s.attended, s.rejection_reason,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE((
          SELECT string_agg(g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = s.student_id AND m.status <> 'left'
        ), '') AS groups
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      LEFT JOIN public.profiles tea ON tea.id = s.teacher_id
      WHERE public.bs_is_admin() OR s.teacher_id = v_uid
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.teacher_confirm_support(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_set_support_attendance(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_start_support_break(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_support_duty(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_teacher_directory() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_teacher_slots(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_coming() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_support_teachers() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_support_teacher_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_support_day(date) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.student_book_support_window(uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_window(uuid, uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_confirm_support(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_set_support_attendance(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_start_support_break(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_support_duty(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_teacher_directory() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_teacher_slots(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_coming() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_support_teachers() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_support_teacher_detail(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_support_day(date) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public._support_release_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public._support_release_window(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS support_sessions_release_rejected ON public.support_sessions;
CREATE TRIGGER support_sessions_release_rejected
  AFTER UPDATE OF status ON public.support_sessions
  FOR EACH ROW EXECUTE FUNCTION public._support_release_rejected();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261022000002', 'support_menus')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
