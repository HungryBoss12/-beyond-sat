-- Behavioral SQL regression test for support teacher booking visibility.
-- Runs inside a rolled-back batch via: node scripts/run-sql-test.mjs [migration.sql] supabase/tests/support_bookings_visibility.sql

DO $$
DECLARE
  v_marjona uuid := '206ba921-80f8-4f48-af03-07b73c6275b9';
  v_mukhammadali uuid := 'ed9024b0-8048-43a1-8951-c664f0f96928';
  v_class_teacher uuid;
  v_student uuid;
  v_rec jsonb;
  v_counts jsonb;
  v_day_far jsonb;
  v_day_orphan jsonb;
  v_coming_ct jsonb;
  v_future_day date := ((now() AT TIME ZONE 'Asia/Tashkent')::date + 22);
  v_orphan_day date := ((now() AT TIME ZONE 'Asia/Tashkent')::date + 23);
  v_orphan_session uuid;
  v_out text := '';
BEGIN
  -- Pick non-Sunday future test days so 15:00–19:00 windows apply.
  IF EXTRACT(DOW FROM v_future_day) = 0 THEN
    v_future_day := v_future_day + 1;
  END IF;
  v_orphan_day := v_future_day + 1;
  IF EXTRACT(DOW FROM v_orphan_day) = 0 THEN
    v_orphan_day := v_orphan_day + 1;
  END IF;

  -- Find a real class teacher who teaches a student already booked with Mukhammadali.
  SELECT g.teacher_id, s.student_id
    INTO v_class_teacher, v_student
  FROM public.support_sessions s
  JOIN public.class_group_memberships m ON m.user_id = s.student_id AND m.status = 'active'
  JOIN public.class_groups g ON g.id = m.group_id
  JOIN public.user_roles ur ON ur.user_id = g.teacher_id AND ur.role::text = 'teacher'
  WHERE s.teacher_id = v_mukhammadali
    AND s.status = 'confirmed'
  ORDER BY s.starts_at DESC
  LIMIT 1;

  -- Insert an orphan confirmed support_session (no support_windows link) to verify day sheet & counts never lose it.
  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, status, origin, preferred_on, expires_at
  )
  VALUES (
    v_student,
    v_mukhammadali,
    NULL,
    'ebrw',
    ((v_orphan_day + time '16:00') AT TIME ZONE 'Asia/Tashkent'),
    ((v_orphan_day + time '16:30') AT TIME ZONE 'Asia/Tashkent'),
    'confirmed',
    'assigned',
    v_orphan_day,
    ((v_orphan_day + time '16:00') AT TIME ZONE 'Asia/Tashkent')
  )
  RETURNING id INTO v_orphan_session;

  -- Act as support teacher Mukhammadali Achildiyev.
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_mukhammadali::text, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_mukhammadali::text, 'role', 'authenticated')::text,
    true
  );

  -- 1. support_received_students() must include students booked with this support teacher even when support_send_student was never called.
  v_rec := public.support_received_students();
  IF jsonb_array_length(v_rec) = 0 THEN
    v_out := v_out || 'FAIL support_received_students empty despite confirmed bookings | ';
  ELSE
    v_out := v_out || format('PASS support_received_students=%s | ', jsonb_array_length(v_rec));
  END IF;

  -- 2. support_month_counts() must return per-day booking counts for this support teacher so the calendar marks booked days.
  BEGIN
    EXECUTE 'SELECT public.support_month_counts($1, $2)'
      INTO v_counts
      USING '2026-11-01'::date, '2026-11-30'::date;
    IF jsonb_array_length(COALESCE(v_counts, '[]'::jsonb)) = 0 THEN
      v_out := v_out || 'FAIL support_month_counts returned no booked days in Nov 2026 | ';
    ELSE
      v_out := v_out || format('PASS support_month_counts_days=%s | ', jsonb_array_length(v_counts));
    END IF;
  EXCEPTION WHEN undefined_function THEN
    v_out := v_out || 'FAIL support_month_counts missing | ';
  END;

  -- 3. support_day_sheet() on a weekday > 14 days ahead must still prepare and return open slots instead of [] ("No slots opened").
  v_day_far := public.support_day_sheet(v_future_day);
  IF jsonb_array_length(v_day_far) = 0 THEN
    v_out := v_out || format('FAIL support_day_sheet empty on future weekday %s | ', v_future_day);
  ELSE
    v_out := v_out || format('PASS support_day_sheet_far=%s | ', jsonb_array_length(v_day_far));
  END IF;

  -- 4. support_day_sheet() must include confirmed support_sessions even if support_windows.session_id was not linked.
  v_day_orphan := public.support_day_sheet(v_orphan_day);
  IF NOT EXISTS (
    SELECT 1 FROM jsonb_array_elements(v_day_orphan) e
    WHERE e->>'session_id' = v_orphan_session::text
  ) THEN
    v_out := v_out || 'FAIL orphan confirmed session hidden from support_day_sheet | ';
  ELSE
    v_out := v_out || 'PASS orphan confirmed session visible in support_day_sheet | ';
  END IF;

  -- 5. Act as class teacher: support_coming() must include confirmed support bookings of students in their active groups.
  IF v_class_teacher IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', v_class_teacher::text, true);
    PERFORM set_config(
      'request.jwt.claims',
      json_build_object('sub', v_class_teacher::text, 'role', 'authenticated')::text,
      true
    );
    v_coming_ct := public.support_coming();
    IF NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_coming_ct) e
      WHERE e->>'id' = v_orphan_session::text
    ) THEN
      v_out := v_out || 'FAIL class teacher cannot see group student booking in support_coming | ';
    ELSE
      v_out := v_out || 'PASS class teacher sees group student booking in support_coming | ';
    END IF;
  END IF;

  RAISE EXCEPTION 'RESULT %', v_out;
END $$;
