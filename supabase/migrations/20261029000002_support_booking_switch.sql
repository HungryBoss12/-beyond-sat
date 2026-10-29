-- Clear future planned support sessions, and let an admin turn student booking off.
-- A student who books can hold only one support session on a given day.

CREATE OR REPLACE FUNCTION public.support_booking_on()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT value FROM public.app_settings WHERE key = 'support_student_booking'
  ), 'off') = 'on';
$$;

REVOKE ALL ON FUNCTION public.support_booking_on() FROM PUBLIC, anon, authenticated;

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
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'confirmed');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
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
  IF NOT public.support_booking_on() THEN
    RETURN '[]'::jsonb;
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
  IF NOT public.support_booking_on() THEN
    RETURN '[]'::jsonb;
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

INSERT INTO public.app_settings (key, value)
VALUES ('support_student_booking', 'off')
ON CONFLICT (key) DO NOTHING;

UPDATE public.support_sessions
SET status = 'rejected',
    rejection_reason = 'bookings cleared'
WHERE status IN ('pending', 'confirmed')
  AND starts_at > now();

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261029000002', 'support_booking_switch')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
