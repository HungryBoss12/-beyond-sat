-- Booking notices name the student and the time, and a cancelled session
-- drops the notice that announced it. Older generic "a student took one of
-- your open sessions" rows are removed when that booking is already gone.

CREATE OR REPLACE FUNCTION public._support_notify_users(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_link text,
  p_source uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF p_user_ids IS NULL OR cardinality(p_user_ids) = 0 THEN
    RETURN;
  END IF;
  INSERT INTO public.user_notifications (
    title, body, link_url, link_label, source_type, source_id, audience_type, created_by, expires_at
  )
  VALUES (
    p_title, p_body, p_link, 'View', 'admin', p_source, 'users', auth.uid(),
    now() + interval '365 days'
  )
  RETURNING id INTO v_id;
  INSERT INTO public.user_notification_recipients (notification_id, user_id)
  SELECT DISTINCT v_id, uid
  FROM unnest(p_user_ids) AS uid
  WHERE uid IS NOT NULL
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._support_notify(
  p_user uuid,
  p_title text,
  p_body text,
  p_link text,
  p_source uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._support_notify_users(ARRAY[p_user], p_title, p_body, p_link, p_source);
END;
$$;

REVOKE ALL ON FUNCTION public._support_notify_users(uuid[], text, text, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_notify(uuid, text, text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._support_release_rejected()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'rejected' AND OLD.status IS DISTINCT FROM 'rejected' THEN
    PERFORM public._support_release_window(NEW.id);
    DELETE FROM public.user_notifications WHERE source_id = NEW.id;
  END IF;
  RETURN NEW;
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

DELETE FROM public.user_notifications n
WHERE n.title = 'Support session booked'
  AND n.body = 'A student took one of your open sessions.'
  AND n.source_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_notification_recipients r
    JOIN public.support_sessions s ON s.teacher_id = r.user_id
    WHERE r.notification_id = n.id
      AND s.status IN ('pending', 'confirmed')
      AND s.origin = 'request'
      AND abs(extract(epoch FROM (s.created_at - n.created_at))) < 120
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261029000005', 'notification_session_notices')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
