-- A nick is private to the signed-in student. The official name cannot be rewritten by that student.

CREATE TABLE IF NOT EXISTS public.profile_nicks (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nick text NOT NULL DEFAULT '',
  CONSTRAINT profile_nicks_length CHECK (char_length(nick) <= 32)
);

ALTER TABLE public.profile_nicks ENABLE ROW LEVEL SECURITY;
GRANT ALL ON public.profile_nicks TO service_role;
REVOKE ALL ON public.profile_nicks FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_nicks TO authenticated;

DROP POLICY IF EXISTS "profile nicks own read" ON public.profile_nicks;
CREATE POLICY "profile nicks own read" ON public.profile_nicks
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "profile nicks own insert" ON public.profile_nicks;
CREATE POLICY "profile nicks own insert" ON public.profile_nicks
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profile nicks own update" ON public.profile_nicks;
CREATE POLICY "profile nicks own update" ON public.profile_nicks
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "profile nicks own delete" ON public.profile_nicks;
CREATE POLICY "profile nicks own delete" ON public.profile_nicks
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bs_lock_profile_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.badge_score IS DISTINCT FROM OLD.badge_score
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.bs_is_admin() THEN
    NEW.badge_score := OLD.badge_score;
  END IF;

  IF auth.role() = 'service_role' OR public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  NEW.full_name := OLD.full_name;
  NEW.first_name := OLD.first_name;
  NEW.last_name := OLD.last_name;
  NEW.banned := OLD.banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;
  NEW.class_id := OLD.class_id;

  IF current_setting('beyondsat.clear_must_change', true) IS DISTINCT FROM 'on' THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  ELSIF NOT (OLD.must_change_credentials IS TRUE AND NEW.must_change_credentials IS FALSE) THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  END IF;

  IF current_setting('beyondsat.complete_intro', true) IS DISTINCT FROM 'on' THEN
    NEW.intro_completed := OLD.intro_completed;
  ELSIF NOT (OLD.intro_completed IS NOT TRUE AND NEW.intro_completed IS TRUE) THEN
    NEW.intro_completed := OLD.intro_completed;
  END IF;

  RETURN NEW;
END;
$$;

WITH cfg AS (
  SELECT set_config('request.jwt.claim.role', 'service_role', true) AS role
)
UPDATE public.profiles p
SET full_name = v.full_name,
    first_name = v.first_name,
    last_name = v.last_name
FROM cfg, (
  VALUES
    ('beyond_sat', 'Jovliyev Fazliddin', 'Jovliyev', 'Fazliddin'),
    ('newtie', 'Sobirov Sultonali', 'Sobirov', 'Sultonali'),
    ('faxriddinov_mirsaid2', 'Faxriddinov Mirsaid', 'Faxriddinov', 'Mirsaid')
) AS v(username, full_name, first_name, last_name)
WHERE p.username = v.username;

UPDATE public.students s
SET full_name = 'Jovliyev Fazliddin'
FROM public.profiles p
WHERE s.user_id = p.id AND p.username = 'beyond_sat';

UPDATE public.students s
SET full_name = 'Sobirov Sultonali'
FROM public.profiles p
WHERE s.user_id = p.id AND p.username = 'newtie';

UPDATE public.students s
SET full_name = 'Faxriddinov Mirsaid'
FROM public.profiles p
WHERE s.user_id = p.id AND p.username = 'faxriddinov_mirsaid2';

INSERT INTO public.profile_nicks (user_id, nick)
SELECT p.id, v.nick
FROM (
  VALUES
    ('beyond_sat', 'XTX'),
    ('newtie', 'Newt'),
    ('faxriddinov_mirsaid2', 'mistake1')
) AS v(username, nick)
JOIN public.profiles p ON p.username = v.username
ON CONFLICT (user_id) DO UPDATE SET nick = EXCLUDED.nick;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261030000003', 'profile_nicks')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
