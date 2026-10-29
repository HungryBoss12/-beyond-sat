-- A slot can carry a note before a student is placed on it.

ALTER TABLE public.support_windows
  ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.support_set_window_note(
  p_window_id uuid,
  p_note text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_windows%ROWTYPE;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  UPDATE public.support_windows SET note = v_note WHERE id = p_window_id;
  IF v_row.session_id IS NOT NULL THEN
    UPDATE public.support_sessions SET task = v_note WHERE id = v_row.session_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.support_set_window_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_set_window_note(uuid, text) TO authenticated, service_role;

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
      SELECT w.id, w.teacher_id, w.starts_at, w.ends_at, w.student_id, w.closed, w.note,
        s.id AS session_id, s.subject, s.attended, s.homework_done,
        COALESCE(s.task, w.note) AS task,
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261029000003', 'support_window_note')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
