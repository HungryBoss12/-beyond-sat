-- One default teacher per subject. The day table shows that name before anyone picks.

ALTER TABLE public.support_subjects
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS support_subjects_one_default
  ON public.support_subjects (subject)
  WHERE is_default;

UPDATE public.support_subjects ss
SET is_default = true
FROM public.profiles p
WHERE p.id = ss.teacher_id
  AND ss.subject = 'math'
  AND p.full_name = 'Marjona Bozorova'
  AND NOT EXISTS (
    SELECT 1 FROM public.support_subjects other
    WHERE other.subject = 'math' AND other.is_default
  );

UPDATE public.support_subjects ss
SET is_default = true
WHERE ss.subject = 'ebrw'
  AND NOT EXISTS (
    SELECT 1 FROM public.support_subjects other
    WHERE other.subject = 'ebrw' AND other.is_default
  )
  AND (
    SELECT count(*) FROM public.support_subjects all_rows
    WHERE all_rows.subject = 'ebrw'
  ) = 1;

CREATE OR REPLACE FUNCTION public.admin_set_support_subject(
  p_teacher uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_teacher AND role::text = 'support_teacher'
  ) THEN
    RAISE EXCEPTION 'That user is not a support teacher';
  END IF;
  INSERT INTO public.support_subjects (teacher_id, subject, is_default)
  VALUES (p_teacher, p_subject, false)
  ON CONFLICT (teacher_id) DO UPDATE
    SET subject = EXCLUDED.subject,
        is_default = false;
  UPDATE public.support_subjects
  SET is_default = true
  WHERE teacher_id = p_teacher
    AND NOT EXISTS (
      SELECT 1 FROM public.support_subjects other
      WHERE other.subject = p_subject AND other.is_default
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.support_send_board()
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
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  v_admin := public.bs_is_admin();
  v_class := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'teacher'
  );
  v_support := EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_uid AND ur.role::text = 'support_teacher'
  );
  IF NOT (v_admin OR v_class OR v_support) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'teachers', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.name)
      FROM (
        SELECT DISTINCT p.id,
          COALESCE(p.full_name, p.username, 'Teacher') AS name,
          ss.subject,
          COALESCE(ss.is_default, false) AS is_default
        FROM public.profiles p
        JOIN public.user_roles ur ON ur.user_id = p.id
        LEFT JOIN public.support_subjects ss ON ss.teacher_id = p.id
        WHERE ur.role::text = 'support_teacher'
          AND (NOT v_support OR v_admin OR v_class OR p.id = v_uid)
      ) t
    ), '[]'::jsonb),
    'students', COALESCE((
      SELECT jsonb_agg(row_to_json(s) ORDER BY s.name)
      FROM (
        SELECT DISTINCT p.id,
          COALESCE(p.full_name, p.username, 'Student') AS name,
          COALESCE((
            SELECT string_agg(DISTINCT g.name, ', ' ORDER BY g.name)
            FROM public.class_group_memberships mm
            JOIN public.class_groups g ON g.id = mm.group_id
            WHERE mm.user_id = p.id AND mm.status = 'active'
              AND (v_admin OR g.teacher_id = v_uid OR v_support)
          ), '') AS class_name,
          r.support_teacher_id,
          COALESCE(st.full_name, st.username) AS support_teacher_name,
          r.subject
        FROM public.profiles p
        JOIN public.class_group_memberships m ON m.user_id = p.id AND m.status = 'active'
        JOIN public.class_groups g ON g.id = m.group_id
        LEFT JOIN public.support_received r ON r.student_id = p.id
          AND (NOT (v_support AND NOT v_admin AND NOT v_class) OR r.support_teacher_id = v_uid)
        LEFT JOIN public.profiles st ON st.id = r.support_teacher_id
        WHERE v_admin
          OR g.teacher_id = v_uid
          OR (v_support AND r.support_teacher_id = v_uid)
      ) s
    ), '[]'::jsonb)
  );
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261030000002', 'support_default_teacher')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
