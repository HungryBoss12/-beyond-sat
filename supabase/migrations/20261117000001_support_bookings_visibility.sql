-- Ensure support teacher bookings are always visible across received lists,
-- month calendars, future day sheets, and class teacher views.

-- 1. Backfill support_received from existing non-rejected support_sessions
--    so students assigned directly onto slots are recorded for their support teacher.
INSERT INTO public.support_received (support_teacher_id, student_id, subject)
SELECT DISTINCT ON (s.teacher_id, s.student_id)
  s.teacher_id,
  s.student_id,
  s.subject
FROM public.support_sessions s
JOIN public.user_roles ur
  ON ur.user_id = s.teacher_id
 AND ur.role::text = 'support_teacher'
WHERE s.teacher_id IS NOT NULL
  AND s.student_id IS NOT NULL
  AND s.status IN ('pending', 'confirmed', 'completed')
ORDER BY s.teacher_id, s.student_id, s.starts_at DESC NULLS LAST, s.created_at DESC
ON CONFLICT (support_teacher_id, student_id) DO NOTHING;

-- 2. Set-based window preparation + single-day preparation up to 60 days ahead.
CREATE OR REPLACE FUNCTION public.support_prepare_windows(p_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_span integer := GREATEST(1, LEAST(COALESCE(p_days, 14), 21));
BEGIN
  IF auth.uid() IS NULL AND current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.support_windows (teacher_id, starts_at, ends_at)
  SELECT
    t.user_id,
    (((v_today + d.offset_days) + time '15:00') AT TIME ZONE 'Asia/Tashkent')
      + make_interval(mins => slot.idx * 30) AS starts_at,
    (((v_today + d.offset_days) + time '15:00') AT TIME ZONE 'Asia/Tashkent')
      + make_interval(mins => (slot.idx + 1) * 30) AS ends_at
  FROM (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role::text = 'support_teacher'
  ) t
  CROSS JOIN generate_series(0, v_span - 1) AS d(offset_days)
  CROSS JOIN generate_series(0, 7) AS slot(idx)
  WHERE EXTRACT(DOW FROM (v_today + d.offset_days)) <> 0
  ON CONFLICT (teacher_id, starts_at) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public._support_prepare_day(p_day date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
BEGIN
  IF p_day IS NULL OR p_day < v_today OR p_day > (v_today + 60) THEN
    RETURN;
  END IF;
  IF EXTRACT(DOW FROM p_day) = 0 THEN
    RETURN;
  END IF;

  INSERT INTO public.support_windows (teacher_id, starts_at, ends_at)
  SELECT
    t.user_id,
    ((p_day + time '15:00') AT TIME ZONE 'Asia/Tashkent')
      + make_interval(mins => slot.idx * 30),
    ((p_day + time '15:00') AT TIME ZONE 'Asia/Tashkent')
      + make_interval(mins => (slot.idx + 1) * 30)
  FROM (
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role::text = 'support_teacher'
  ) t
  CROSS JOIN generate_series(0, 7) AS slot(idx)
  ON CONFLICT (teacher_id, starts_at) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public._support_prepare_day(date) FROM PUBLIC, anon, authenticated;

-- 3. Non-blocking missed-session flagger (SKIP LOCKED avoids concurrent day-sheet stalls).
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
    SELECT *
    FROM public.support_sessions
    WHERE student_id IS NOT NULL
      AND ends_at < now()
      AND missed_notified_at IS NULL
      AND status IN ('confirmed', 'completed')
      AND attended IS DISTINCT FROM true
    FOR UPDATE SKIP LOCKED
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

REVOKE ALL ON FUNCTION public.support_flag_missed() FROM PUBLIC, anon, authenticated;

-- 4. Keep support_received synchronized whenever staff or students book a window,
--    and notify the support teacher when another staff member assigns a student.
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
  v_student_name text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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
    IF NOT EXISTS (
      SELECT 1
      FROM public.support_sessions s
      WHERE s.teacher_id = v_row.teacher_id
        AND s.student_id = p_student_id
        AND s.status IN ('pending', 'confirmed', 'completed')
    ) THEN
      RAISE EXCEPTION 'That student has not been sent to this support teacher';
    END IF;
  END IF;

  INSERT INTO public.support_received (support_teacher_id, student_id, subject, assigned_by)
  VALUES (v_row.teacher_id, p_student_id, p_subject, v_uid)
  ON CONFLICT (support_teacher_id, student_id) DO UPDATE
    SET subject = EXCLUDED.subject,
        assigned_by = COALESCE(EXCLUDED.assigned_by, public.support_received.assigned_by);

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
  IF v_row.teacher_id IS DISTINCT FROM v_uid THEN
    SELECT COALESCE(NULLIF(btrim(full_name), ''), username, 'A student')
      INTO v_student_name
    FROM public.profiles
    WHERE id = p_student_id;
    PERFORM public._support_notify(
      v_row.teacher_id,
      'Support session assigned',
      COALESCE(v_student_name, 'A student') || ' was booked on ' || v_when || '.',
      '/admin/support',
      v_session
    );
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
  v_day date;
  v_session uuid;
  v_name text;
  v_when text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

  INSERT INTO public.support_received (support_teacher_id, student_id, subject, assigned_by)
  VALUES (v_row.teacher_id, v_uid, p_subject, v_uid)
  ON CONFLICT (support_teacher_id, student_id) DO UPDATE
    SET subject = EXCLUDED.subject;

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

-- 5. support_received_students includes both support_received rows and any student
--    with a non-rejected session with that support teacher.
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  v_teacher := CASE
    WHEN public.bs_is_admin() THEN COALESCE(p_teacher, v_uid)
    ELSE v_uid
  END;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT
        pool.student_id AS id,
        COALESCE(p.full_name, p.username, 'Student') AS name,
        pool.subject,
        COALESCE((
          SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = pool.student_id AND m.status = 'active'
        ), '') AS class_name,
        COALESCE(sender.full_name, sender.username, 'Staff') AS sent_by
      FROM (
        SELECT DISTINCT ON (src.student_id)
          src.student_id,
          src.subject,
          src.assigned_by
        FROM (
          SELECT r.student_id, r.subject, r.assigned_by, 0 AS prio, r.created_at AS sort_at
          FROM public.support_received r
          WHERE r.support_teacher_id = v_teacher
          UNION ALL
          SELECT s.student_id, s.subject, NULL::uuid AS assigned_by, 1 AS prio, COALESCE(s.starts_at, s.created_at) AS sort_at
          FROM public.support_sessions s
          WHERE s.teacher_id = v_teacher
            AND s.status IN ('pending', 'confirmed', 'completed')
        ) src
        ORDER BY src.student_id, src.prio ASC, src.sort_at DESC
      ) pool
      JOIN public.profiles p ON p.id = pool.student_id
      LEFT JOIN public.profiles sender ON sender.id = pool.assigned_by
    ) x
  ), '[]'::jsonb);
END;
$$;

-- 6. Per-day booking counts across a date range for month calendar indicators.
CREATE OR REPLACE FUNCTION public.support_month_counts(p_from date, p_to date)
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
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to < p_from OR (p_to - p_from) > 93 THEN
    RAISE EXCEPTION 'Pick a valid date range';
  END IF;
  v_admin := public.bs_is_admin();
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'teacher'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'support_teacher'::public.app_role)
  INTO v_class, v_support;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.day)
    FROM (
      SELECT
        to_char((s.starts_at AT TIME ZONE 'Asia/Tashkent')::date, 'YYYY-MM-DD') AS day,
        count(*)::integer AS count
      FROM public.support_sessions s
      WHERE s.starts_at IS NOT NULL
        AND s.status IN ('pending', 'confirmed', 'completed')
        AND (s.starts_at AT TIME ZONE 'Asia/Tashkent')::date BETWEEN p_from AND p_to
        AND (
          v_admin
          OR (v_support AND NOT v_class AND s.teacher_id = v_uid)
          OR (
            v_class
            AND (
              s.teacher_id = v_uid
              OR EXISTS (
                SELECT 1
                FROM public.class_groups g
                JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
                WHERE g.teacher_id = v_uid AND m.user_id = s.student_id
              )
            )
          )
        )
      GROUP BY 1
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_month_counts(date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.support_month_counts(date, date) TO authenticated, service_role;

-- 7. support_day_sheet prepares the requested weekday (up to 60 days ahead),
--    heals any unlinked window matching an active session at the same teacher & start,
--    and includes any remaining non-rejected session on p_day even without a window row.
CREATE OR REPLACE FUNCTION public.support_day_sheet(p_day date, p_teacher uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_teacher uuid;
  v_admin boolean;
  v_class boolean;
  v_support boolean;
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  PERFORM public.support_prepare_windows(14);
  PERFORM public._support_prepare_day(p_day);
  PERFORM public.support_flag_missed();

  -- Self-heal any open window on p_day that matches an unlinked active session.
  UPDATE public.support_windows w
  SET student_id = s.student_id,
      session_id = s.id
  FROM (
    SELECT DISTINCT ON (s0.teacher_id, s0.starts_at)
      s0.id, s0.teacher_id, s0.student_id, s0.starts_at
    FROM public.support_sessions s0
    WHERE s0.starts_at IS NOT NULL
      AND (s0.starts_at AT TIME ZONE 'Asia/Tashkent')::date = p_day
      AND s0.status IN ('pending', 'confirmed', 'completed')
      AND NOT EXISTS (
        SELECT 1 FROM public.support_windows linked WHERE linked.session_id = s0.id
      )
    ORDER BY s0.teacher_id, s0.starts_at, s0.created_at DESC
  ) s
  WHERE w.teacher_id = s.teacher_id
    AND w.starts_at = s.starts_at
    AND w.session_id IS NULL
    AND w.student_id IS NULL;

  v_admin := public.bs_is_admin();
  SELECT
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'teacher'::public.app_role),
    EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = v_uid AND ur.role = 'support_teacher'::public.app_role)
  INTO v_class, v_support;

  v_teacher := CASE
    WHEN v_admin THEN p_teacher
    WHEN v_support AND NOT v_class THEN v_uid
    ELSE NULL
  END;

  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at, x.teacher_name)
    FROM (
      SELECT
        w.id,
        w.teacher_id,
        w.starts_at,
        w.ends_at,
        COALESCE(s.student_id, w.student_id) AS student_id,
        w.closed,
        w.note,
        s.id AS session_id,
        CASE
          WHEN COALESCE(s.student_id, w.student_id) IS NOT NULL THEN COALESCE(s.subject, ss.subject)
          ELSE s.subject
        END AS subject,
        s.attended,
        s.homework_done,
        COALESCE(s.task, w.note) AS task,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE(stu.full_name, stu.username) AS student_name
      FROM public.support_windows w
      JOIN public.profiles tea ON tea.id = w.teacher_id
      LEFT JOIN public.support_subjects ss ON ss.teacher_id = w.teacher_id
      LEFT JOIN public.support_sessions s
        ON s.id = w.session_id
       AND s.status IN ('pending', 'confirmed', 'completed')
      LEFT JOIN public.profiles stu ON stu.id = COALESCE(s.student_id, w.student_id)
      WHERE (w.starts_at AT TIME ZONE 'Asia/Tashkent')::date = p_day
        AND (v_teacher IS NULL OR w.teacher_id = v_teacher)
        AND (v_admin OR w.teacher_id = v_uid OR v_class)

      UNION ALL

      SELECT
        s.id,
        s.teacher_id,
        s.starts_at,
        COALESCE(s.ends_at, s.starts_at + interval '30 minutes') AS ends_at,
        s.student_id,
        false AS closed,
        NULL::text AS note,
        s.id AS session_id,
        s.subject,
        s.attended,
        s.homework_done,
        s.task,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE(stu.full_name, stu.username) AS student_name
      FROM public.support_sessions s
      JOIN public.profiles tea ON tea.id = s.teacher_id
      LEFT JOIN public.profiles stu ON stu.id = s.student_id
      WHERE s.starts_at IS NOT NULL
        AND (s.starts_at AT TIME ZONE 'Asia/Tashkent')::date = p_day
        AND s.status IN ('pending', 'confirmed', 'completed')
        AND NOT EXISTS (
          SELECT 1 FROM public.support_windows w2 WHERE w2.session_id = s.id
        )
        AND (v_teacher IS NULL OR s.teacher_id = v_teacher)
        AND (v_admin OR s.teacher_id = v_uid OR v_class)
    ) x
  ), '[]'::jsonb);
END;
$$;

-- 8. support_coming and support_staff_sessions include today's & upcoming sessions for
--    support teachers, admins, and class teachers whose group students are booked.
CREATE OR REPLACE FUNCTION public.support_coming()
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
  v_today_start timestamptz := ((now() AT TIME ZONE 'Asia/Tashkent')::date::timestamp AT TIME ZONE 'Asia/Tashkent');
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  v_admin := public.bs_is_admin();
  v_class := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'teacher'::public.app_role
  );
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT
        s.id,
        s.starts_at,
        s.ends_at,
        s.origin,
        s.status,
        s.attended,
        s.subject,
        s.task,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE((
          SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = s.student_id AND m.status <> 'left'
        ), '') AS groups
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      LEFT JOIN public.profiles tea ON tea.id = s.teacher_id
      WHERE s.status IN ('pending', 'confirmed', 'completed')
        AND s.starts_at IS NOT NULL
        AND COALESCE(s.ends_at, s.starts_at) >= LEAST(v_today_start, now() - interval '12 hours')
        AND (
          v_admin
          OR s.teacher_id = v_uid
          OR (
            v_class
            AND EXISTS (
              SELECT 1
              FROM public.class_groups g
              JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
              WHERE g.teacher_id = v_uid AND m.user_id = s.student_id
            )
          )
        )
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_staff_sessions()
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
BEGIN
  IF v_uid IS NULL OR NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  v_admin := public.bs_is_admin();
  v_class := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role = 'teacher'::public.app_role
  );
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at NULLS LAST)
    FROM (
      SELECT
        s.id,
        s.student_id,
        s.teacher_id,
        s.origin,
        s.status,
        s.subject,
        s.starts_at,
        s.ends_at,
        s.attended,
        s.rejection_reason,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        COALESCE((
          SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
          FROM public.class_group_memberships m
          JOIN public.class_groups g ON g.id = m.group_id
          WHERE m.user_id = s.student_id AND m.status <> 'left'
        ), '') AS groups
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      LEFT JOIN public.profiles tea ON tea.id = s.teacher_id
      WHERE v_admin
        OR s.teacher_id = v_uid
        OR (
          v_class
          AND EXISTS (
            SELECT 1
            FROM public.class_groups g
            JOIN public.class_group_memberships m ON m.group_id = g.id AND m.status = 'active'
            WHERE g.teacher_id = v_uid AND m.user_id = s.student_id
          )
        )
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.support_prepare_windows(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_assign_support_window(uuid, uuid, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_book_support_window(uuid, public.class_subject) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_received_students(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_day_sheet(date, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_coming() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_staff_sessions() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.support_prepare_windows(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_window(uuid, uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_book_support_window(uuid, public.class_subject) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_received_students(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_day_sheet(date, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_coming() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_staff_sessions() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261117000001', 'support_bookings_visibility')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
