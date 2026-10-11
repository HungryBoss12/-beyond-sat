-- Review fixes. Deleting an open slot must not erase completed or declined
-- sessions. Booking requires a current class and one pending request. Material
-- links are https only.

ALTER TABLE public.support_sessions DROP CONSTRAINT IF EXISTS support_sessions_slot_id_fkey;
ALTER TABLE public.support_sessions ALTER COLUMN slot_id DROP NOT NULL;
ALTER TABLE public.support_sessions
  ADD CONSTRAINT support_sessions_slot_id_fkey
  FOREIGN KEY (slot_id) REFERENCES public.teacher_availability_slots(id) ON DELETE SET NULL;

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
  IF v_url IS NOT NULL AND v_url !~* '^https://' THEN
    RAISE EXCEPTION 'The link must start with https://';
  END IF;
  IF v_url IS NULL AND p_test_id IS NULL THEN
    RAISE EXCEPTION 'Add a link or a test';
  END IF;
  IF p_test_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.tests WHERE id = p_test_id AND published IS TRUE
  ) THEN
    RAISE EXCEPTION 'Test not found';
  END IF;
  INSERT INTO public.support_session_materials (session_id, title, material_url, test_id)
  VALUES (p_session_id, btrim(p_title), v_url, p_test_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_request_support(uuid, public.class_subject, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.teacher_add_support_material(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_request_support(uuid, public.class_subject, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.teacher_add_support_material(uuid, text, text, uuid) TO authenticated, service_role;
