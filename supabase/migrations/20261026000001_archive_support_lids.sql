-- Permanent delete from the archive, automatic support slots, and the Lids list.

CREATE OR REPLACE FUNCTION public.admin_purge_archived_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.classes c
    WHERE c.id = p_class_id AND c.archived_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Only an archived class can be deleted';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ledger_entries e
    WHERE e.class_id = p_class_id
       OR e.group_id IN (SELECT g.id FROM public.class_groups g WHERE g.class_id = p_class_id)
  ) THEN
    RAISE EXCEPTION 'This class has payment history, so it stays in the archive';
  END IF;
  DELETE FROM public.classes WHERE id = p_class_id AND archived_at IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_purge_archived_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_purge_archived_class(uuid) TO authenticated, service_role;

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS homework_done boolean,
  ADD COLUMN IF NOT EXISTS task text,
  ADD COLUMN IF NOT EXISTS missed_notified_at timestamptz;

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
BEGIN
  RAISE EXCEPTION 'Support is assigned by a teacher. Book an empty slot if one is free.';
END;
$$;

CREATE OR REPLACE FUNCTION public.support_prepare_windows(p_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
  v_day date;
  v_end date;
  v_i integer;
  v_start timestamptz;
BEGIN
  IF auth.uid() IS NULL AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  v_day := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_end := v_day + GREATEST(1, LEAST(COALESCE(p_days, 14), 21));
  FOR v_teacher IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role::text = 'support_teacher'
  LOOP
    WHILE v_day < v_end LOOP
      FOR v_i IN 0..7 LOOP
        v_start := ((v_day + time '15:00') AT TIME ZONE 'Asia/Tashkent') + make_interval(mins => v_i * 30);
        INSERT INTO public.support_windows (teacher_id, starts_at, ends_at)
        VALUES (v_teacher, v_start, v_start + interval '30 minutes')
        ON CONFLICT (teacher_id, starts_at) DO NOTHING;
      END LOOP;
      v_day := v_day + 1;
    END LOOP;
    v_day := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_flag_missed()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_sessions%ROWTYPE;
BEGIN
  FOR v_row IN
    SELECT * FROM public.support_sessions
    WHERE student_id IS NOT NULL
      AND ends_at < now()
      AND missed_notified_at IS NULL
      AND status IN ('confirmed', 'completed')
      AND attended IS DISTINCT FROM true
    FOR UPDATE
  LOOP
    UPDATE public.support_sessions
    SET missed_notified_at = now()
    WHERE id = v_row.id;
    PERFORM public._support_notify(
      v_row.student_id,
      'You missed the support lesson',
      'This support session ended and you were not marked present.'
    );
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_day_sheet(p_day date, p_teacher uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
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
  PERFORM public.support_prepare_windows(14);
  PERFORM public.support_flag_missed();
  v_teacher := CASE
    WHEN public.bs_is_admin() THEN p_teacher
    ELSE v_uid
  END;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at, x.teacher_name)
    FROM (
      SELECT w.id, w.teacher_id, w.starts_at, w.ends_at, w.student_id, w.closed,
        s.id AS session_id, s.subject, s.attended, s.homework_done, s.task,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE(stu.full_name, stu.username) AS student_name
      FROM public.support_windows w
      JOIN public.profiles tea ON tea.id = w.teacher_id
      LEFT JOIN public.support_sessions s ON s.id = w.session_id
      LEFT JOIN public.profiles stu ON stu.id = w.student_id
      WHERE (w.starts_at AT TIME ZONE 'Asia/Tashkent')::date = p_day
        AND (v_teacher IS NULL OR w.teacher_id = v_teacher)
        AND (public.bs_is_admin() OR w.teacher_id = v_uid)
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_group_students(p_teacher uuid)
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
  v_teacher := CASE WHEN public.bs_is_admin() AND p_teacher IS NOT NULL THEN p_teacher ELSE v_uid END;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT DISTINCT p.id, COALESCE(p.full_name, p.username, 'Student') AS name
      FROM public.class_groups g
      JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
      JOIN public.profiles p ON p.id = m.user_id
      WHERE g.teacher_id = v_teacher
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_set_tick(
  p_session_id uuid,
  p_field text,
  p_value boolean
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
  IF p_field NOT IN ('attendance', 'homework') THEN
    RAISE EXCEPTION 'Unknown tick';
  END IF;
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_field = 'attendance' THEN
    UPDATE public.support_sessions SET attended = p_value WHERE id = p_session_id;
    IF p_value IS FALSE AND v_row.missed_notified_at IS NULL THEN
      UPDATE public.support_sessions SET missed_notified_at = now() WHERE id = p_session_id;
      PERFORM public._support_notify(
        v_row.student_id,
        'You missed the support lesson',
        'You were marked absent from this support session.'
      );
    END IF;
  ELSE
    UPDATE public.support_sessions SET homework_done = p_value WHERE id = p_session_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_set_task(p_session_id uuid, p_task text)
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
  UPDATE public.support_sessions
  SET task = NULLIF(btrim(COALESCE(p_task, '')), '')
  WHERE id = p_session_id;
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
  UPDATE public.support_windows SET student_id = v_uid WHERE id = p_window_id;
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject);
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
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
  PERFORM public.support_flag_missed();
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at NULLS LAST)
    FROM (
      SELECT s.id, s.teacher_id, s.origin, s.status, s.subject, s.starts_at, s.ends_at,
        s.rejection_reason, s.task, s.attended, s.homework_done,
        COALESCE(p.full_name, p.username, 'Teacher') AS teacher_name
      FROM public.support_sessions s
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.student_id = v_uid
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE TABLE IF NOT EXISTS public.lids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text NOT NULL,
  wanted_class text NOT NULL,
  note text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'accepted')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.lids ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lids TO service_role;
REVOKE ALL ON public.lids FROM anon, authenticated, PUBLIC;

DROP POLICY IF EXISTS "lids admin" ON public.lids;
CREATE POLICY "lids admin" ON public.lids
  FOR ALL TO authenticated
  USING (public.bs_is_admin())
  WITH CHECK (public.bs_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lids TO authenticated;

CREATE OR REPLACE FUNCTION public.public_submit_lid(
  p_name text,
  p_phone text,
  p_class text,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF btrim(COALESCE(p_name, '')) = '' OR btrim(COALESCE(p_phone, '')) = '' OR btrim(COALESCE(p_class, '')) = '' THEN
    RAISE EXCEPTION 'Name, phone, and class are required';
  END IF;
  IF char_length(p_name) > 120 OR char_length(p_phone) > 40 OR char_length(p_class) > 80 THEN
    RAISE EXCEPTION 'That entry is too long';
  END IF;
  INSERT INTO public.lids (full_name, phone, wanted_class, note)
  VALUES (
    btrim(p_name),
    btrim(p_phone),
    btrim(p_class),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_save_lid(
  p_id uuid,
  p_name text,
  p_phone text,
  p_class text,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF btrim(COALESCE(p_name, '')) = '' OR btrim(COALESCE(p_phone, '')) = '' OR btrim(COALESCE(p_class, '')) = '' THEN
    RAISE EXCEPTION 'Name, phone, and class are required';
  END IF;
  IF p_id IS NULL THEN
    INSERT INTO public.lids (full_name, phone, wanted_class, note)
    VALUES (btrim(p_name), btrim(p_phone), btrim(p_class), NULLIF(btrim(COALESCE(p_note, '')), ''))
    RETURNING id INTO v_id;
    RETURN v_id;
  END IF;
  UPDATE public.lids
  SET full_name = btrim(p_name),
      phone = btrim(p_phone),
      wanted_class = btrim(p_class),
      note = NULLIF(btrim(COALESCE(p_note, '')), '')
  WHERE id = p_id
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_lid_status(p_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_status NOT IN ('new', 'accepted') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  UPDATE public.lids SET status = p_status WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
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
  IF NOT EXISTS (
    SELECT 1
    FROM public.class_groups g
    JOIN public.class_group_memberships m ON m.group_id = g.id
    WHERE g.teacher_id = v_row.teacher_id
      AND m.user_id = p_student_id
      AND m.status = 'active'
  ) THEN
    RAISE EXCEPTION 'That student is not in this teacher''s groups';
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

REVOKE ALL ON FUNCTION public.support_prepare_windows(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_flag_missed() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.support_day_sheet(date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_group_students(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_set_tick(uuid, text, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_set_task(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.public_submit_lid(text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_save_lid(uuid, text, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_lid_status(uuid, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.support_prepare_windows(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_day_sheet(date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_group_students(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_set_tick(uuid, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_set_task(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_submit_lid(text, text, text, text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_save_lid(uuid, text, text, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_lid_status(uuid, text) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261026000001', 'archive_support_lids')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
