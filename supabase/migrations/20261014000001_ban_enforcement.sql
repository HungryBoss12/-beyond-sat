-- A banned account keeps a valid session after email sign-in. Restrictive
-- policies fail every authenticated query while the ban is on. Reading your
-- own profile still works so the suspended page can show the reason.

CREATE OR REPLACE FUNCTION public.bs_is_self_banned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.banned FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.bs_is_self_banned() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_is_self_banned() TO authenticated, service_role;

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "banned accounts blocked" ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY "banned accounts blocked" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.bs_is_self_banned()) WITH CHECK (NOT public.bs_is_self_banned())',
      r.relname
    );
  END LOOP;
END $$;

DROP POLICY IF EXISTS "banned accounts blocked read" ON public.profiles;
CREATE POLICY "banned accounts blocked read" ON public.profiles
  AS RESTRICTIVE FOR SELECT TO authenticated
  USING (NOT public.bs_is_self_banned() OR id = auth.uid());

DROP POLICY IF EXISTS "banned accounts blocked insert" ON public.profiles;
CREATE POLICY "banned accounts blocked insert" ON public.profiles
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (NOT public.bs_is_self_banned());

DROP POLICY IF EXISTS "banned accounts blocked update" ON public.profiles;
CREATE POLICY "banned accounts blocked update" ON public.profiles
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (NOT public.bs_is_self_banned())
  WITH CHECK (NOT public.bs_is_self_banned());

DROP POLICY IF EXISTS "banned accounts blocked delete" ON public.profiles;
CREATE POLICY "banned accounts blocked delete" ON public.profiles
  AS RESTRICTIVE FOR DELETE TO authenticated
  USING (NOT public.bs_is_self_banned());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261014000001', 'ban_enforcement')
ON CONFLICT (version) DO NOTHING;
