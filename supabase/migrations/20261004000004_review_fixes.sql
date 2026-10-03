-- admin_set_student_fee reports how many class prices it wrote.
-- Closed registration trusts staff_created only from app metadata.

DROP FUNCTION IF EXISTS public.admin_set_student_fee(uuid, uuid, bigint, date);

CREATE FUNCTION public.admin_set_student_fee(
  p_user_id uuid,
  p_class_id uuid,
  p_fee_uzs bigint,
  p_effective_from date DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
  v_group uuid;
  v_class uuid;
  v_saved integer := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 1000 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Fee must be between 1 000 and 100 000 000 UZS';
  END IF;
  FOR v_class IN
    SELECT DISTINCT g.class_id
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
      AND m.status <> 'left'
      AND (p_class_id IS NULL OR g.class_id = p_class_id)
  LOOP
    SELECT g.id INTO v_group
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
      AND g.class_id = v_class
      AND m.status <> 'left'
    ORDER BY CASE WHEN g.subject = 'math' THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_group IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.student_fee_overrides (user_id, group_id, monthly_fee_uzs, effective_from, created_by)
    VALUES (p_user_id, v_group, p_fee_uzs, v_from, auth.uid())
    ON CONFLICT (user_id, group_id, effective_from) DO UPDATE
      SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
          created_by = EXCLUDED.created_by,
          created_at = now();
    v_saved := v_saved + 1;
  END LOOP;
  RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_fee(uuid, uuid, bigint, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_fee(uuid, uuid, bigint, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb);
  first_name text;
  last_name text;
  display_name text;
  parts text[];
BEGIN
  IF COALESCE(app_meta->>'staff_created', '') IS DISTINCT FROM 'true'
     AND NOT public.get_registration_state() THEN
    RAISE EXCEPTION 'registration is closed'
      USING ERRCODE = '42501';
  END IF;

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
