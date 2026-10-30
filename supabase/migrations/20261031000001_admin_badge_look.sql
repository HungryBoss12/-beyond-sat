-- Admins set the badge text and color in the same place as the score.

DROP FUNCTION IF EXISTS public.admin_set_badge_score(uuid, integer);

CREATE FUNCTION public.admin_set_badge_score(
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
  IF p_score IS NULL THEN
    v_label := NULL;
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
      badge_label = CASE WHEN p_score IS NULL THEN NULL ELSE badge_label END,
      badge_color = CASE WHEN p_score IS NULL THEN NULL ELSE badge_color END
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- A first score and its text cannot be written together: the lock keeps the
  -- text empty until a score already exists. The second write runs after that.
  IF p_score IS NOT NULL THEN
    UPDATE public.profiles
    SET badge_label = v_label,
        badge_color = v_color
    WHERE id = p_user_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_badge_score(uuid, integer, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_badge_score(uuid, integer, text, text) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261031000001', 'admin_badge_look')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
