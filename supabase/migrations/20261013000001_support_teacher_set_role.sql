-- admin_set_role still rejected support_teacher after the enum value landed,
-- so the Students role menu raised "Unknown role: support_teacher".

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF p_role NOT IN ('student', 'editor', 'admin', 'teacher', 'support_teacher') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_user_id
     AND role::text IN ('admin', 'editor', 'teacher', 'support_teacher');

  IF p_role IN ('teacher', 'support_teacher') THEN
    DELETE FROM public.user_roles
     WHERE user_id = p_user_id AND role = 'student';
  END IF;

  IF p_role <> 'student' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN NOT public.bs_is_admin() THEN NULL
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'admin'::public.app_role
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'editor'::public.app_role
    ) THEN 'editor'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'teacher'::public.app_role
    ) THEN 'teacher'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'support_teacher'::public.app_role
    ) THEN 'support_teacher'
    ELSE 'student'
  END;
$$;
