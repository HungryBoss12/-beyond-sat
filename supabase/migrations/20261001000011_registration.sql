-- Registration is off until an admin turns it on in Settings.

INSERT INTO public.app_settings (key, value)
VALUES ('registration_enabled', 'false')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_registration_state()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT value FROM public.app_settings WHERE key = 'registration_enabled'),
    'false'
  ) = 'true';
$$;

REVOKE ALL ON FUNCTION public.get_registration_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_registration_state() TO anon, authenticated, service_role;
