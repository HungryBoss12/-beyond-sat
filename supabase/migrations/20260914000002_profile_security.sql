-- Lock ban / first-login flags so students cannot self-unban or skip password
-- change. Replace the class-chat profile SELECT leak with a directory view.

CREATE OR REPLACE FUNCTION public.bs_lock_profile_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  NEW.banned := OLD.banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;

  IF current_setting('beyondsat.clear_must_change', true) IS DISTINCT FROM 'on' THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  ELSIF NOT (OLD.must_change_credentials IS TRUE AND NEW.must_change_credentials IS FALSE) THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bs_profiles_lock_security_columns ON public.profiles;
CREATE TRIGGER bs_profiles_lock_security_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.bs_lock_profile_security_columns();

CREATE OR REPLACE FUNCTION public.bs_complete_first_login(
  p_user_id uuid,
  p_username text,
  p_email text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uname text;
  mail text;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing user';
  END IF;

  uname := nullif(btrim(p_username), '');
  mail := nullif(btrim(p_email), '');

  IF uname IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(uname)
      AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'username taken';
  END IF;

  PERFORM set_config('beyondsat.clear_must_change', 'on', true);

  UPDATE public.profiles
  SET
    username = COALESCE(uname, username),
    email = COALESCE(mail, email),
    must_change_credentials = false
  WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_complete_first_login(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bs_complete_first_login(uuid, text, text) TO service_role;

DROP POLICY IF EXISTS "Authenticated read class profiles" ON public.profiles;

DROP VIEW IF EXISTS public.chat_directory;
CREATE VIEW public.chat_directory
WITH (security_invoker = false) AS
SELECT
  id,
  username,
  avatar_url,
  telegram_username,
  telegram_connected_at,
  chat_setup_completed,
  class_id,
  full_name,
  first_name,
  last_name
FROM public.profiles
WHERE username IS NOT NULL
  AND chat_setup_completed = true
  AND banned IS NOT TRUE;

REVOKE ALL ON public.chat_directory FROM PUBLIC;
GRANT SELECT ON public.chat_directory TO authenticated;
