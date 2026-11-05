-- A badge can be text with no SAT score. An empty score used to wipe the
-- text, so saving a teacher's label reported that the badge was removed.

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

  -- Students cannot invent a badge. An admin can set text before any score exists.
  IF NEW.badge_score IS NULL
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.bs_is_admin() THEN
    NEW.badge_label := OLD.badge_label;
    NEW.badge_color := OLD.badge_color;
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

CREATE OR REPLACE FUNCTION public.admin_set_badge_score(
  p_user_id uuid,
  p_score integer,
  p_label text DEFAULT NULL,
  p_color text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text := NULLIF(btrim(COALESCE(p_label, '')), '');
  v_color text := NULLIF(btrim(COALESCE(p_color, '')), '');
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_score IS NOT NULL AND (p_score < 400 OR p_score > 1600) THEN
    RAISE EXCEPTION 'Score must be between 400 and 1600';
  END IF;
  IF p_score IS NULL AND v_label IS NULL THEN
    v_color := NULL;
  END IF;
  IF v_label IS NOT NULL AND char_length(v_label) > 16 THEN
    RAISE EXCEPTION 'Badge text can be at most 16 characters';
  END IF;
  IF v_color IS NOT NULL AND v_color NOT IN ('purple', 'blue', 'green', 'gold', 'red') THEN
    RAISE EXCEPTION 'Pick a badge color';
  END IF;

  UPDATE public.profiles
  SET badge_score = p_score,
      badge_label = v_label,
      badge_color = v_color
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261106000001', 'text_only_badge')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
