-- Support sessions. The center hours are one row an admin edits. A teacher
-- adds a concrete slot inside those hours and off their class timetable. A
-- student books a free slot. Pending and confirmed sessions hold it.

CREATE TABLE IF NOT EXISTS public.support_center_hours (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  opens_at time NOT NULL,
  closes_at time NOT NULL,
  CONSTRAINT support_center_hours_order CHECK (opens_at < closes_at)
);

INSERT INTO public.support_center_hours (opens_at, closes_at)
VALUES ('09:00', '21:00')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.teacher_availability_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT teacher_availability_slots_order CHECK (starts_at < ends_at)
);

CREATE INDEX IF NOT EXISTS teacher_availability_slots_teacher_idx
  ON public.teacher_availability_slots (teacher_id, starts_at);

CREATE TABLE IF NOT EXISTS public.support_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  slot_id uuid NOT NULL REFERENCES public.teacher_availability_slots(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'rejected', 'completed')),
  notes text,
  rejection_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS support_sessions_student_idx
  ON public.support_sessions (student_id, starts_at);
CREATE INDEX IF NOT EXISTS support_sessions_teacher_idx
  ON public.support_sessions (teacher_id, status, starts_at);
CREATE UNIQUE INDEX IF NOT EXISTS support_sessions_one_hold
  ON public.support_sessions (slot_id)
  WHERE status IN ('pending', 'confirmed');

CREATE TABLE IF NOT EXISTS public.support_session_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  material_url text,
  test_id uuid REFERENCES public.tests(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT support_session_materials_body CHECK (material_url IS NOT NULL OR test_id IS NOT NULL)
);

ALTER TABLE public.support_center_hours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_session_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support hours read" ON public.support_center_hours;
CREATE POLICY "support hours read" ON public.support_center_hours
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "support slots read" ON public.teacher_availability_slots;
CREATE POLICY "support slots read" ON public.teacher_availability_slots
  FOR SELECT TO authenticated
  USING (
    public.bs_is_admin()
    OR teacher_id = auth.uid()
    OR NOT EXISTS (
      SELECT 1 FROM public.support_sessions s
      WHERE s.slot_id = teacher_availability_slots.id
        AND s.status IN ('pending', 'confirmed')
    )
  );

DROP POLICY IF EXISTS "support sessions read" ON public.support_sessions;
CREATE POLICY "support sessions read" ON public.support_sessions
  FOR SELECT TO authenticated
  USING (
    public.bs_is_admin()
    OR student_id = auth.uid()
    OR teacher_id = auth.uid()
  );

DROP POLICY IF EXISTS "support materials read" ON public.support_session_materials;
CREATE POLICY "support materials read" ON public.support_session_materials
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.support_sessions s
      WHERE s.id = session_id
        AND (
          public.bs_is_admin()
          OR s.student_id = auth.uid()
          OR s.teacher_id = auth.uid()
        )
    )
  );

GRANT SELECT ON public.support_center_hours TO authenticated;
GRANT SELECT ON public.teacher_availability_slots TO authenticated;
GRANT SELECT ON public.support_sessions TO authenticated;
GRANT SELECT ON public.support_session_materials TO authenticated;
GRANT ALL ON public.support_center_hours TO service_role;
GRANT ALL ON public.teacher_availability_slots TO service_role;
GRANT ALL ON public.support_sessions TO service_role;
GRANT ALL ON public.support_session_materials TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.support_center_hours FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.teacher_availability_slots FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_sessions FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.support_session_materials FROM authenticated, anon, PUBLIC;

CREATE OR REPLACE FUNCTION public._support_tashkent_day(p_at timestamptz)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT extract(isodow FROM p_at AT TIME ZONE 'Asia/Tashkent')::integer;
$$;

CREATE OR REPLACE FUNCTION public._support_overlaps_class(
  p_user_id uuid,
  p_start timestamptz,
  p_end timestamptz,
  p_as_teacher boolean
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_groups g
    WHERE g.start_time IS NOT NULL
      AND g.end_time IS NOT NULL
      AND g.schedule_days @> ARRAY[public._support_tashkent_day(p_start)]::smallint[]
      AND g.start_time < (p_end AT TIME ZONE 'Asia/Tashkent')::time
      AND g.end_time > (p_start AT TIME ZONE 'Asia/Tashkent')::time
      AND (
        (p_as_teacher AND g.teacher_id = p_user_id)
        OR (
          NOT p_as_teacher
          AND EXISTS (
            SELECT 1 FROM public.class_group_memberships m
            WHERE m.group_id = g.id
              AND m.user_id = p_user_id
              AND m.status <> 'left'
          )
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public._support_within_hours(
  p_start timestamptz,
  p_end timestamptz
)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_open time;
  v_close time;
  v_start time;
  v_end time;
BEGIN
  SELECT opens_at, closes_at INTO v_open, v_close FROM public.support_center_hours LIMIT 1;
  IF v_open IS NULL THEN
    RAISE EXCEPTION 'Center hours are not set';
  END IF;
  IF (p_start AT TIME ZONE 'Asia/Tashkent')::date
     IS DISTINCT FROM (p_end AT TIME ZONE 'Asia/Tashkent')::date THEN
    RAISE EXCEPTION 'A slot stays inside one day';
  END IF;
  v_start := (p_start AT TIME ZONE 'Asia/Tashkent')::time;
  v_end := (p_end AT TIME ZONE 'Asia/Tashkent')::time;
  IF v_start < v_open OR v_end > v_close THEN
    RAISE EXCEPTION 'That time is outside center hours';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_support_hours(p_opens time, p_closes time)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_opens IS NULL OR p_closes IS NULL OR p_opens >= p_closes THEN
    RAISE EXCEPTION 'Closing time must be after opening time';
  END IF;
  INSERT INTO public.support_center_hours (id, opens_at, closes_at)
  VALUES (true, p_opens, p_closes)
  ON CONFLICT (id) DO UPDATE SET opens_at = EXCLUDED.opens_at, closes_at = EXCLUDED.closes_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_add_support_slot(
  p_start timestamptz,
  p_end timestamptz,
  p_teacher_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid := COALESCE(p_teacher_id, auth.uid());
  v_id uuid;
BEGIN
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    public.bs_is_admin()
    OR (
      v_teacher = auth.uid()
      AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'teacher')
    )
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_start IS NULL OR p_end IS NULL OR p_start >= p_end OR p_start < now() THEN
    RAISE EXCEPTION 'Pick a future start and a later end';
  END IF;
  PERFORM public._support_within_hours(p_start, p_end);
  IF public._support_overlaps_class(v_teacher, p_start, p_end, true) THEN
    RAISE EXCEPTION 'That overlaps a class you teach';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.teacher_availability_slots s
    WHERE s.teacher_id = v_teacher
      AND s.starts_at < p_end
      AND s.ends_at > p_start
  ) THEN
    RAISE EXCEPTION 'That overlaps another open slot';
  END IF;
  INSERT INTO public.teacher_availability_slots (teacher_id, starts_at, ends_at)
  VALUES (v_teacher, p_start, p_end)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_delete_support_slot(p_slot_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
BEGIN
  SELECT teacher_id INTO v_teacher FROM public.teacher_availability_slots WHERE id = p_slot_id;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Slot not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_teacher = auth.uid()) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.slot_id = p_slot_id AND s.status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'That slot has a request';
  END IF;
  DELETE FROM public.teacher_availability_slots WHERE id = p_slot_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_request_support(
  p_slot_id uuid,
  p_subject public.class_subject,
  p_notes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_slot public.teacher_availability_slots%ROWTYPE;
  v_id uuid;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  SELECT * INTO v_slot FROM public.teacher_availability_slots WHERE id = p_slot_id;
  IF v_slot.id IS NULL THEN
    RAISE EXCEPTION 'That slot is not open';
  END IF;
  IF v_slot.starts_at < now() THEN
    RAISE EXCEPTION 'That slot has already started';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.slot_id = p_slot_id AND s.status IN ('pending', 'confirmed')
  ) THEN
    RAISE EXCEPTION 'That slot is already taken';
  END IF;
  PERFORM public._support_within_hours(v_slot.starts_at, v_slot.ends_at);
  IF public._support_overlaps_class(v_student, v_slot.starts_at, v_slot.ends_at, false) THEN
    RAISE EXCEPTION 'That overlaps your class';
  END IF;
  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, notes
  )
  VALUES (
    v_student, v_slot.teacher_id, v_slot.id, p_subject, v_slot.starts_at, v_slot.ends_at,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._support_notify(p_student uuid, p_title text, p_body text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.user_notifications (
    title, body, link_url, link_label, source_type, audience_type, created_by, expires_at
  )
  VALUES (
    p_title, p_body, '/support-lessons', 'View', 'admin', 'users', auth.uid(),
    now() + interval '365 days'
  )
  RETURNING id INTO v_id;
  INSERT INTO public.user_notification_recipients (notification_id, user_id)
  VALUES (v_id, p_student);
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_decide_support(
  p_session_id uuid,
  p_accept boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'That request is no longer pending';
  END IF;
  IF p_accept THEN
    UPDATE public.support_sessions SET status = 'confirmed' WHERE id = p_session_id;
    PERFORM public._support_notify(
      v_row.student_id,
      'Support session confirmed',
      'Your ' || CASE WHEN v_row.subject = 'math' THEN 'Math' ELSE 'English' END || ' session is confirmed.'
    );
  ELSE
    UPDATE public.support_sessions
    SET status = 'rejected',
        rejection_reason = NULLIF(btrim(COALESCE(p_reason, '')), '')
    WHERE id = p_session_id;
    PERFORM public._support_notify(
      v_row.student_id,
      'Support session declined',
      COALESCE(NULLIF(btrim(COALESCE(p_reason, '')), ''), 'Your support request was declined.')
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_complete_support(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_sessions%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_row.teacher_id = auth.uid()) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_row.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Only a confirmed session can be completed';
  END IF;
  UPDATE public.support_sessions SET status = 'completed' WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_add_support_material(
  p_session_id uuid,
  p_title text,
  p_url text DEFAULT NULL,
  p_test_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
  v_id uuid;
  v_url text := NULLIF(btrim(COALESCE(p_url, '')), '');
BEGIN
  SELECT teacher_id INTO v_teacher FROM public.support_sessions WHERE id = p_session_id;
  IF v_teacher IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF NOT (public.bs_is_admin() OR v_teacher = auth.uid()) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF NULLIF(btrim(COALESCE(p_title, '')), '') IS NULL THEN
    RAISE EXCEPTION 'A title is required';
  END IF;
  IF v_url IS NULL AND p_test_id IS NULL THEN
    RAISE EXCEPTION 'Add a link or a test';
  END IF;
  IF p_test_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.tests WHERE id = p_test_id) THEN
    RAISE EXCEPTION 'Test not found';
  END IF;
  INSERT INTO public.support_session_materials (session_id, title, material_url, test_id)
  VALUES (p_session_id, btrim(p_title), v_url, p_test_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_open_slots()
RETURNS TABLE (
  slot_id uuid,
  teacher_id uuid,
  teacher_name text,
  starts_at timestamptz,
  ends_at timestamptz
)
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
  RETURN QUERY
  SELECT s.id, s.teacher_id,
    COALESCE(p.full_name, p.username, 'Teacher'),
    s.starts_at, s.ends_at
  FROM public.teacher_availability_slots s
  JOIN public.profiles p ON p.id = s.teacher_id
  WHERE s.starts_at > now()
    AND NOT EXISTS (
      SELECT 1 FROM public.support_sessions held
      WHERE held.slot_id = s.id AND held.status IN ('pending', 'confirmed')
    )
    AND NOT public._support_overlaps_class(v_uid, s.starts_at, s.ends_at, false)
  ORDER BY s.starts_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_my_sessions()
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
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at DESC)
    FROM (
      SELECT s.id, s.teacher_id,
        COALESCE(p.full_name, p.username, 'Teacher') AS teacher_name,
        s.subject, s.starts_at, s.ends_at, s.status, s.notes, s.rejection_reason,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'title', m.title, 'material_url', m.material_url, 'test_id', m.test_id
          ) ORDER BY m.created_at)
          FROM public.support_session_materials m
          WHERE m.session_id = s.id
        ), '[]'::jsonb) AS materials
      FROM public.support_sessions s
      JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.student_id = v_uid
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
  v_admin boolean := public.bs_is_admin();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT (
    v_admin
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'teacher')
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT s.id, s.student_id, s.teacher_id,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE(tea.full_name, tea.username, 'Teacher') AS teacher_name,
        s.subject, s.starts_at, s.ends_at, s.status, s.notes, s.rejection_reason, s.slot_id,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'title', m.title, 'material_url', m.material_url, 'test_id', m.test_id
          ) ORDER BY m.created_at)
          FROM public.support_session_materials m
          WHERE m.session_id = s.id
        ), '[]'::jsonb) AS materials
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      JOIN public.profiles tea ON tea.id = s.teacher_id
      WHERE v_admin OR s.teacher_id = v_uid
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public._support_tashkent_day(timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._support_overlaps_class(uuid, timestamptz, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_within_hours(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_notify(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_support_hours(time, time) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_add_support_slot(timestamptz, timestamptz, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_delete_support_slot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.student_request_support(uuid, public.class_subject, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_decide_support(uuid, boolean, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_complete_support(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_add_support_material(uuid, text, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_open_slots() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_my_sessions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_staff_sessions() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_support_hours(time, time) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_add_support_slot(timestamptz, timestamptz, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_delete_support_slot(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.student_request_support(uuid, public.class_subject, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_decide_support(uuid, boolean, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_complete_support(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_add_support_material(uuid, text, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_open_slots() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_my_sessions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_staff_sessions() TO authenticated, service_role;
