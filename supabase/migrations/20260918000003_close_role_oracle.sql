-- Role/ban-status enumeration oracle, take 2.
--
-- Reality on the live database (verified by probing):
--   * bs_is_admin(uuid DEFAULT auth.uid()) etc. are ONE function each — there
--     is no separate zero-arg overload, so "grant zero-arg, revoke uuid" is
--     impossible as written in the plan. Worse, EXECUTE was granted to PUBLIC
--     (`=X/postgres` in the ACL), so a blanket REVOKE ... FROM authenticated
--     was a no-op for callers.
--   * Every RLS policy calls the zero-arg form (auth.uid()-defaulted) and
--     keeps working when called as the affected user.
--   * Four SECURITY DEFINER functions pass explicit uids from server-side
--     contexts: admin_by_telegram_chat, admin_list_telegram_admins,
--     admin_revoke_telegram_admin, admin_users_summary (verified: they are the
--     only `bs_is_admin(p.id)` callers).
--
-- Fix strategy:
--   1. Clamp the uid-parameterized bs_* forms: a caller may only ever resolve
--      their own uid; any other uid returns false. This kills the "is user X
--      admin/banned?" oracle for arbitrary UUIDs while every zero-arg policy
--      call (self) keeps its meaning.
--   2. Move the four internal callers to private.bs_is_admin_for(uid), which
--      is only granted to service_role — those functions run as definer/
--      service_role anyway.
--   3. Revoke the now-foreign-uid clamped public forms from anon/authenticated
--      outright: policies evaluate them as the calling role, but policy
--      evaluation is not gated by EXECUTE privileges (PostgreSQL does not
--      check function ACLs inside policy expressions), and our app's direct
--      RPC calls are all zero-arg. Anon loses the function entirely.
--   4. private.has_role(uuid, role): used by ~30 policies as
--      has_role(auth.uid(), ...). Clamp it the same way (uid must equal the
--      caller), which is a no-op for every existing policy, and drop the
--      anon EXECUTE grant.
--   5. admin_user_role(uuid) — an even cheaper oracle ("what role is user X")
--      granted to authenticated — gets an explicit admin gate like its
--      siblings.

REVOKE EXECUTE ON FUNCTION public.bs_is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bs_is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bs_is_banned(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.bs_is_editor(uuid) FROM PUBLIC, anon, authenticated;

-- Re-grant to authenticated only: the client app calls the zero-arg form via
-- PostgREST rpc (bs_is_staff with {} in requireStaff, bs_is_admin in the
-- telegram webhook check). Policies work regardless of the grant.
GRANT EXECUTE ON FUNCTION public.bs_is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_banned(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_editor(uuid) TO authenticated;

-- 1. Clamp: you can only ask about yourself.
CREATE OR REPLACE FUNCTION public.bs_is_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_editor(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'editor'
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_staff(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = _uid AND r.role IN ('admin', 'editor')
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_banned(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _uid = auth.uid() AND COALESCE(
    (SELECT p.banned FROM public.profiles p WHERE p.id = _uid), false
  );
$$;

-- 2. Internal (service-side) helper for the four definer functions that
--    legitimately test other users' roles.
CREATE OR REPLACE FUNCTION private.bs_is_admin_for(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = p_user_id AND r.role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION private.bs_is_admin_for(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.bs_is_admin_for(uuid) TO service_role;

-- 3. has_role clamps too (every live policy passes auth.uid()).
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 4. admin_user_role: role-discovery oracle, now admin-gated like its siblings.
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
    ELSE 'student'
  END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_user_role(uuid) TO authenticated;
