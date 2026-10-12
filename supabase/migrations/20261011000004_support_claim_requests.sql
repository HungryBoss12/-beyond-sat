-- Open support requests. A student picks a day, every teacher is notified, and
-- any teacher can claim it or step aside with a note. The request closes when
-- the last teacher declines, or after two days with no claim.

ALTER TABLE public.support_sessions ALTER COLUMN teacher_id DROP NOT NULL;
ALTER TABLE public.support_sessions ALTER COLUMN starts_at DROP NOT NULL;
ALTER TABLE public.support_sessions ALTER COLUMN ends_at DROP NOT NULL;

ALTER TABLE public.support_sessions
  ADD COLUMN IF NOT EXISTS preferred_on date,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

UPDATE public.support_sessions
SET preferred_on = (starts_at AT TIME ZONE 'Asia/Tashkent')::date
WHERE preferred_on IS NULL AND starts_at IS NOT NULL;

UPDATE public.support_sessions
SET expires_at = created_at + interval '2 days'
WHERE expires_at IS NULL;

ALTER TABLE public.support_sessions ALTER COLUMN expires_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.support_request_passes (
  session_id uuid NOT NULL REFERENCES public.support_sessions(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, teacher_id)
);

ALTER TABLE public.support_request_passes ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.support_request_passes TO service_role;
REVOKE ALL ON public.support_request_passes FROM authenticated, anon, PUBLIC;

DROP POLICY IF EXISTS "support sessions read" ON public.support_sessions;
CREATE POLICY "support sessions read" ON public.support_sessions
  FOR SELECT TO authenticated
  USING (
    public.bs_is_admin()
    OR student_id = auth.uid()
    OR teacher_id = auth.uid()
    OR (
      status = 'pending'
      AND teacher_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
      )
    )
  );

DROP FUNCTION IF EXISTS public._support_notify(uuid, text, text);

CREATE OR REPLACE FUNCTION public._support_notify_users(
  p_user_ids uuid[],
  p_title text,
  p_body text,
  p_link text
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
    title, body, link_url, link_label, source_type, audience_type, created_by, expires_at
  )
  VALUES (
    p_title, p_body, p_link, 'View', 'admin', 'users', auth.uid(),
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
  p_link text DEFAULT '/support-lessons'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._support_notify_users(ARRAY[p_user], p_title, p_body, p_link);
END;
$$;

CREATE OR REPLACE FUNCTION public._support_expire_requests()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.support_sessions%ROWTYPE;
BEGIN
  FOR v_row IN
    UPDATE public.support_sessions
    SET status = 'rejected',
        rejection_reason = 'No teacher claimed this in time.'
    WHERE status = 'pending'
      AND expires_at < now()
    RETURNING *
  LOOP
    PERFORM public._support_notify(
      v_row.student_id,
      'Support request expired',
      'No teacher claimed this in time.'
    );
  END LOOP;
END;
$$;

DROP FUNCTION IF EXISTS public.student_request_support(uuid, public.class_subject, text);

CREATE OR REPLACE FUNCTION public.student_request_support(
  p_subject public.class_subject,
  p_notes text,
  p_day date
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_subject text;
  v_teachers uuid[];
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF p_day IS NULL OR p_day < (now() AT TIME ZONE 'Asia/Tashkent')::date THEN
    RAISE EXCEPTION 'Pick today or a later date';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_student AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can request support';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.student_id = v_student AND s.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request';
  END IF;

  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, notes, preferred_on, expires_at
  )
  VALUES (
    v_student, NULL, NULL, p_subject, NULL, NULL,
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_day,
    now() + interval '2 days'
  )
  RETURNING id INTO v_id;

  SELECT COALESCE(full_name, username, 'A student') INTO v_name
  FROM public.profiles WHERE id = v_student;
  v_subject := CASE WHEN p_subject = 'math' THEN 'Math' ELSE 'English' END;
  SELECT COALESCE(array_agg(DISTINCT ur.user_id), ARRAY[]::uuid[]) INTO v_teachers
  FROM public.user_roles ur
  WHERE ur.role = 'teacher';
  PERFORM public._support_notify_users(
    v_teachers,
    'New support request',
    v_name || ' asked for ' || v_subject || ' on ' || to_char(p_day, 'DD Mon') || '.',
    '/admin/support'
  );
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public._support_can_staff()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
    );
$$;

CREATE OR REPLACE FUNCTION public.teacher_claim_support(
  p_session_id uuid,
  p_start timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_name text;
  v_row public.support_sessions%ROWTYPE;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_start IS NOT NULL AND p_start <= now() THEN
    RAISE EXCEPTION 'Pick a later time';
  END IF;
  PERFORM public._support_expire_requests();

  UPDATE public.support_sessions
  SET teacher_id = v_uid,
      status = 'confirmed',
      starts_at = p_start,
      ends_at = CASE WHEN p_start IS NULL THEN NULL ELSE p_start + interval '1 hour' END
  WHERE id = p_session_id
    AND status = 'pending'
    AND (teacher_id IS NULL OR teacher_id = v_uid)
    AND expires_at > now()
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That request is no longer open';
  END IF;

  SELECT COALESCE(full_name, username, 'A teacher') INTO v_name
  FROM public.profiles WHERE id = v_uid;
  v_body := v_name || ' claimed your '
    || CASE WHEN v_row.subject = 'math' THEN 'Math' ELSE 'English' END
    || ' request.';
  IF p_start IS NOT NULL THEN
    v_body := v_body || ' It starts '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.';
  END IF;
  PERFORM public._support_notify(v_row.student_id, 'Support request claimed', v_body);
END;
$$;

CREATE OR REPLACE FUNCTION public.teacher_decline_support(
  p_session_id uuid,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_sessions%ROWTYPE;
  v_name text;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_left integer;
  v_close boolean;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public._support_expire_requests();

  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_row.status <> 'pending' THEN
    RAISE EXCEPTION 'That request is no longer pending';
  END IF;
  IF v_row.teacher_id IS NOT NULL AND v_row.teacher_id <> v_uid AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.support_request_passes (session_id, teacher_id, note)
  VALUES (p_session_id, v_uid, v_note)
  ON CONFLICT (session_id, teacher_id) DO UPDATE SET note = EXCLUDED.note;

  SELECT count(*) INTO v_left
  FROM public.user_roles ur
  WHERE ur.role = 'teacher'
    AND ur.user_id <> v_uid
    AND NOT EXISTS (
      SELECT 1 FROM public.support_request_passes p
      WHERE p.session_id = p_session_id AND p.teacher_id = ur.user_id
    );

  v_close := v_row.teacher_id IS NOT NULL OR v_left = 0;
  SELECT COALESCE(full_name, username, 'A teacher') INTO v_name
  FROM public.profiles WHERE id = v_uid;

  IF v_close THEN
    UPDATE public.support_sessions
    SET status = 'rejected',
        rejection_reason = COALESCE(v_note, 'Declined')
    WHERE id = p_session_id;
    PERFORM public._support_notify(
      v_row.student_id,
      'Support request declined',
      v_name || ' declined your request. ' || COALESCE(v_note, 'No note was added.')
    );
  ELSE
    PERFORM public._support_notify(
      v_row.student_id,
      'A teacher declined your request',
      v_name || COALESCE(': ' || v_note, ' declined.') || ' Other teachers can still claim it.'
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.support_set_start(
  p_session_id uuid,
  p_start timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_sessions%ROWTYPE;
  v_body text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF p_start IS NOT NULL AND p_start <= now() THEN
    RAISE EXCEPTION 'Pick a later time';
  END IF;
  SELECT * INTO v_row FROM public.support_sessions WHERE id = p_session_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_row.status <> 'confirmed' THEN
    RAISE EXCEPTION 'Set a time after the request is claimed';
  END IF;
  IF NOT (
    public.bs_is_admin()
    OR v_row.student_id = v_uid
    OR v_row.teacher_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.support_sessions
  SET starts_at = p_start,
      ends_at = CASE WHEN p_start IS NULL THEN NULL ELSE p_start + interval '1 hour' END
  WHERE id = p_session_id;

  IF p_start IS NULL THEN
    v_body := 'The start time was cleared.';
  ELSE
    v_body := 'The lesson starts '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.';
  END IF;

  IF v_uid = v_row.student_id THEN
    IF v_row.teacher_id IS NOT NULL THEN
      PERFORM public._support_notify(v_row.teacher_id, 'Support time updated', v_body, '/admin/support');
    END IF;
  ELSIF v_uid = v_row.teacher_id THEN
    PERFORM public._support_notify(v_row.student_id, 'Support time updated', v_body);
  ELSE
    PERFORM public._support_notify(v_row.student_id, 'Support time updated', v_body);
    IF v_row.teacher_id IS NOT NULL THEN
      PERFORM public._support_notify(v_row.teacher_id, 'Support time updated', v_body, '/admin/support');
    END IF;
  END IF;
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
  PERFORM public._support_expire_requests();
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT s.id, s.teacher_id,
        COALESCE(p.full_name, p.username, 'Waiting for a teacher') AS teacher_name,
        s.subject, s.starts_at, s.ends_at, s.status, s.notes, s.rejection_reason,
        s.preferred_on, s.expires_at, s.created_at,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'teacher_name', COALESCE(tp.full_name, tp.username, 'Teacher'),
            'note', pass.note
          ) ORDER BY pass.created_at)
          FROM public.support_request_passes pass
          JOIN public.profiles tp ON tp.id = pass.teacher_id
          WHERE pass.session_id = s.id
        ), '[]'::jsonb) AS passes,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'title', m.title, 'material_url', m.material_url, 'test_id', m.test_id
          ) ORDER BY m.created_at)
          FROM public.support_session_materials m
          WHERE m.session_id = s.id
        ), '[]'::jsonb) AS materials
      FROM public.support_sessions s
      LEFT JOIN public.profiles p ON p.id = s.teacher_id
      WHERE s.student_id = v_uid
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_staff_sessions()
RETURNS jsonb
LANGUAGE plpgsql
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
  IF NOT public._support_can_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  PERFORM public._support_expire_requests();
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.created_at DESC)
    FROM (
      SELECT s.id, s.student_id, s.teacher_id,
        COALESCE(stu.full_name, stu.username, 'Student') AS student_name,
        COALESCE(tea.full_name, tea.username, 'Waiting for a teacher') AS teacher_name,
        s.subject, s.starts_at, s.ends_at, s.status, s.notes, s.rejection_reason,
        s.preferred_on, s.expires_at, s.created_at,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'teacher_name', COALESCE(tp.full_name, tp.username, 'Teacher'),
            'note', pass.note
          ) ORDER BY pass.created_at)
          FROM public.support_request_passes pass
          JOIN public.profiles tp ON tp.id = pass.teacher_id
          WHERE pass.session_id = s.id
        ), '[]'::jsonb) AS passes,
        COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id', m.id, 'title', m.title, 'material_url', m.material_url, 'test_id', m.test_id
          ) ORDER BY m.created_at)
          FROM public.support_session_materials m
          WHERE m.session_id = s.id
        ), '[]'::jsonb) AS materials
      FROM public.support_sessions s
      JOIN public.profiles stu ON stu.id = s.student_id
      LEFT JOIN public.profiles tea ON tea.id = s.teacher_id
      WHERE v_admin
        OR s.teacher_id = v_uid
        OR (
          s.status = 'pending'
          AND (s.teacher_id IS NULL OR s.teacher_id = v_uid)
          AND NOT EXISTS (
            SELECT 1 FROM public.support_request_passes pass
            WHERE pass.session_id = s.id AND pass.teacher_id = v_uid
          )
        )
        OR EXISTS (
          SELECT 1 FROM public.support_request_passes pass
          WHERE pass.session_id = s.id AND pass.teacher_id = v_uid AND s.status = 'rejected'
        )
    ) x
  ), '[]'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public._support_notify(uuid, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_notify_users(uuid[], text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_expire_requests() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._support_can_staff() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.student_request_support(public.class_subject, text, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_claim_support(uuid, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_decline_support(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.support_set_start(uuid, timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.student_request_support(public.class_subject, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_claim_support(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_decline_support(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_set_start(uuid, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_my_sessions() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.support_staff_sessions() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261011000004', 'support_claim_requests')
ON CONFLICT (version) DO NOTHING;
