-- Google OAuth metadata uses given_name / family_name / full_name / name,
-- while email signup still writes first_name / last_name. Prefer the email
-- fields, then Google's given/family names, then split full_name/name.
-- intro_completed stays at its column default (false) so Google signups
-- still enter onboarding.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  first_name text;
  last_name text;
  display_name text;
  parts text[];
BEGIN
  first_name := NULLIF(btrim(meta->>'first_name'), '');
  last_name := NULLIF(btrim(meta->>'last_name'), '');

  IF first_name IS NULL THEN
    first_name := NULLIF(btrim(meta->>'given_name'), '');
  END IF;
  IF last_name IS NULL THEN
    last_name := NULLIF(btrim(meta->>'family_name'), '');
  END IF;

  display_name := NULLIF(btrim(COALESCE(meta->>'full_name', meta->>'name')), '');

  IF (first_name IS NULL OR last_name IS NULL) AND display_name IS NOT NULL THEN
    parts := regexp_split_to_array(display_name, '\s+');
    IF first_name IS NULL AND array_length(parts, 1) >= 1 THEN
      first_name := parts[1];
    END IF;
    IF last_name IS NULL AND array_length(parts, 1) >= 2 THEN
      last_name := array_to_string(parts[2:array_length(parts, 1)], ' ');
    END IF;
  END IF;

  IF display_name IS NULL THEN
    display_name := NULLIF(btrim(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), '');
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, city, school, grade, birth_date, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    first_name,
    last_name,
    NULLIF(btrim(meta->>'city'), ''),
    NULLIF(btrim(meta->>'school'), ''),
    NULLIF(meta->>'grade', '')::INT,
    NULLIF(meta->>'birth_date', '')::DATE,
    display_name
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
