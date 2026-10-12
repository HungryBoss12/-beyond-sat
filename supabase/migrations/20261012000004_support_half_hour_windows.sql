-- Half-hour support windows. Staff may assign any time ahead. A student may
-- take an open window only when it starts within 24 hours.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'support_teacher';

CREATE TABLE IF NOT EXISTS public.support_windows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  student_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_windows_half CHECK (ends_at = starts_at + interval '30 minutes'),
  CONSTRAINT support_windows_unique UNIQUE (teacher_id, starts_at)
);

ALTER TABLE public.support_windows ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.support_windows TO authenticated;
GRANT ALL ON public.support_windows TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.support_windows FROM authenticated, anon, PUBLIC;

DROP POLICY IF EXISTS "support windows read" ON public.support_windows;
CREATE POLICY "support windows read" ON public.support_windows
  FOR SELECT TO authenticated
  USING (
    public.bs_is_admin()
    OR teacher_id = auth.uid()
    OR student_id = auth.uid()
    OR (
      student_id IS NULL
      AND starts_at > now()
      AND starts_at <= now() + interval '24 hours'
    )
  );

CREATE OR REPLACE FUNCTION public._support_is_support_staff(p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user AND ur.role::text IN ('teacher', 'support_teacher')
    );
$$;

CREATE OR REPLACE FUNCTION public.teacher_post_support_range(
  p_start timestamptz,
  p_end timestamptz,
  p_teacher uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher uuid;
  v_at timestamptz;
  v_added integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_is_support_staff(v_uid) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  v_teacher := CASE
    WHEN public.bs_is_admin() AND p_teacher IS NOT NULL THEN p_teacher
    ELSE v_uid
  END;
  IF p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RAISE EXCEPTION 'Pick a later end time';
  END IF;
  IF p_end - p_start > interval '14 hours' THEN
    RAISE EXCEPTION 'A range stays inside one day';
  END IF;
  v_at := p_start;
  WHILE v_at + interval '30 minutes' <= p_end LOOP
    INSERT INTO public.support_windows (teacher_id, starts_at, ends_at)
    VALUES (v_teacher, v_at, v_at + interval '30 minutes')
    ON CONFLICT (teacher_id, starts_at) DO NOTHING;
    IF FOUND THEN
      v_added := v_added + 1;
    END IF;
    v_at := v_at + interval '30 minutes';
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_assign_support_window(p_window_id uuid, p_student_id uuid)
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
  IF NOT (
    public.bs_is_admin()
    OR v_row.teacher_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.student_id IS NOT NULL THEN
    RAISE EXCEPTION 'That window is already taken';
  END IF;
  IF v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That window has already started';
  END IF;
  UPDATE public.support_windows SET student_id = p_student_id WHERE id = p_window_id;
  PERFORM public._support_notify(
    p_student_id,
    'Support session assigned',
    'A teacher assigned you a support window.'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.student_book_support_window(p_window_id uuid)
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
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_uid AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can book support';
  END IF;
  UPDATE public.support_windows
  SET student_id = v_uid
  WHERE id = p_window_id
    AND student_id IS NULL
    AND starts_at > now()
    AND starts_at <= now() + interval '24 hours'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That window is not open for students yet';
  END IF;
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
      SELECT w.id, w.teacher_id, w.starts_at, w.ends_at, w.student_id,
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
        AND w.starts_at > now()
        AND w.starts_at <= now() + interval '24 hours'
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public._support_is_support_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.teacher_post_support_range(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_assign_support_window(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_book_support_window(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_window_board() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_bookable_windows() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.teacher_post_support_range(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_window(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_book_support_window(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_window_board() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_bookable_windows() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000004', 'support_half_hour_windows')
ON CONFLICT (version) DO NOTHING;
