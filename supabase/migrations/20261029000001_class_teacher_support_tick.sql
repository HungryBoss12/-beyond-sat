-- A class teacher can mark attendance for a support session when the student is in their group.

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
  v_in_group boolean;
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
  v_in_group := EXISTS (
    SELECT 1
    FROM public.class_groups g
    JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
    WHERE g.teacher_id = v_uid AND m.user_id = v_row.student_id
  );
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = v_uid OR v_in_group) THEN
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261029000001', 'class_teacher_support_tick')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
