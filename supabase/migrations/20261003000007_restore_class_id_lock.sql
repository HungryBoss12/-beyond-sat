-- 20261003000004 replaced the profile lock from an older copy and dropped the
-- class_id guard added in 20260915000005. Put that guard back, and keep
-- intro_completed locked to the onboarding function.

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
