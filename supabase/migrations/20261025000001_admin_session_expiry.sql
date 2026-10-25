-- Admin rights lapse 12 hours after the admin last signed in with a password
-- or link (the JWT's amr timestamp survives token refreshes). Other roles keep
-- their sessions. Requests without a user JWT (service role) are unaffected.
-- The 12 must match ADMIN_SESSION_HOURS in src/lib/auth/session-policy.ts.

CREATE OR REPLACE FUNCTION public.bs_admin_session_fresh()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN jsonb_typeof(auth.jwt() -> 'amr') IS DISTINCT FROM 'array' THEN true
    ELSE COALESCE((
      SELECT max((a ->> 'timestamp')::bigint)
      FROM jsonb_array_elements(auth.jwt() -> 'amr') a
      WHERE (a ->> 'timestamp') ~ '^\d+$'
    ), 0) > extract(epoch FROM now()) - 12 * 3600
  END;
$$;

GRANT EXECUTE ON FUNCTION public.bs_admin_session_fresh() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bs_is_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false)
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin')
    AND public.bs_admin_session_fresh();
$$;

CREATE OR REPLACE FUNCTION public.bs_is_staff(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND (
    EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'editor')
    OR (
      EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin')
      AND public.bs_admin_session_fresh()
    )
  );
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    AND (_role <> 'admin' OR public.bs_admin_session_fresh());
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261025000001', 'admin_session_expiry')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
