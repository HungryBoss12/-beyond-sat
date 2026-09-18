-- NULL-safe clamped role checks.
--
-- The C3 clamps compare `_uid = auth.uid()`, which evaluates to NULL (not
-- false) when no JWT claim is present. Callers — and RLS policies — treat
-- NULL as "deny", but a bare NULL leaking out of a boolean function is
-- ambiguous. Make every clamped check return a strict boolean: false unless
-- the caller is provably asking about themselves.

CREATE OR REPLACE FUNCTION public.bs_is_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_staff(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.role IN ('admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_banned(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND COALESCE(
    (SELECT p.banned FROM public.profiles p WHERE p.id = _uid), false
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_editor(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'editor'
  );
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false) AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION public.bs_is_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bs_is_staff(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bs_is_banned(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bs_is_editor(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_editor(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;
