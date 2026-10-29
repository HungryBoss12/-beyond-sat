-- Lids board stages, open support booking, and the accountant's collect notes.

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public' AND rel.relname = 'lids' AND con.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE public.lids DROP CONSTRAINT %I', r.conname);
  END LOOP;
END $$;
UPDATE public.lids
SET status = CASE status
  WHEN 'accepted' THEN 'enrolled'
  WHEN 'new' THEN 'inquiry'
  ELSE status
END;
ALTER TABLE public.lids ALTER COLUMN status SET DEFAULT 'inquiry';
ALTER TABLE public.lids
  ADD CONSTRAINT lids_status_check
  CHECK (status IN ('inquiry', 'contact', 'in_progress', 'enrolled'));

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
  IF p_status = 'new' THEN
    p_status := 'inquiry';
  ELSIF p_status = 'accepted' THEN
    p_status := 'enrolled';
  END IF;
  IF p_status NOT IN ('inquiry', 'contact', 'in_progress', 'enrolled') THEN
    RAISE EXCEPTION 'Unknown status';
  END IF;
  UPDATE public.lids SET status = p_status WHERE id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;
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
  v_class boolean;
  v_support boolean;
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public.support_prepare_windows(14);
  PERFORM public.support_flag_missed();
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'teacher'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'support_teacher'::public.app_role)
  INTO v_class, v_support;
  v_teacher := CASE
    WHEN public.bs_is_admin() THEN p_teacher
    WHEN v_support AND NOT v_class THEN v_uid
    ELSE NULL
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
        AND (
          public.bs_is_admin()
          OR w.teacher_id = v_uid
          OR v_class
        )
    ) x
  ), '[]'::jsonb);
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
  SELECT subject INTO v_subject
  FROM public.support_received
  WHERE support_teacher_id = v_row.teacher_id AND student_id = p_student_id;
  IF v_row.teacher_id = v_uid AND NOT public.bs_is_admin() AND v_subject IS NULL THEN
    RAISE EXCEPTION 'That student has not been sent to this support teacher';
  END IF;
  PERFORM public._support_session_for_window(
    p_window_id, p_student_id, p_subject, 'assigned', 'confirmed'
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
  v_in_group boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  v_in_group := v_row.student_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.class_groups g
    JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
    WHERE g.teacher_id = v_uid AND m.user_id = v_row.student_id
  );
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid OR v_in_group) THEN
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
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'confirmed');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
END;
$$;

CREATE TABLE IF NOT EXISTS public.payment_collect_notes (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  expect_on date,
  reason text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, class_id, subject)
);

ALTER TABLE public.payment_collect_notes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.payment_collect_notes TO service_role;
REVOKE ALL ON public.payment_collect_notes FROM anon, PUBLIC;

DROP POLICY IF EXISTS "collect notes staff" ON public.payment_collect_notes;
CREATE POLICY "collect notes staff" ON public.payment_collect_notes
  FOR ALL TO authenticated
  USING (
    public.bs_is_admin()
    OR public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'::public.app_role
    )
  )
  WITH CHECK (
    public.bs_is_admin()
    OR public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'::public.app_role
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_collect_notes TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261027000001', 'lids_board_collect_notes')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
