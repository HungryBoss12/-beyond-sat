-- The Students list reloads through this function. Without teacher it paints Student
-- again after an admin assigns that role.

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
    ELSE 'student'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_role(uuid) TO authenticated;
