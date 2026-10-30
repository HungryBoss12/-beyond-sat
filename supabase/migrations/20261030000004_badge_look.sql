-- The owner of a badge may pick its color and a short label. The label replaces the score on the pill.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS badge_label text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS badge_color text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_badge_label_len;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_badge_label_len
  CHECK (badge_label IS NULL OR char_length(badge_label) BETWEEN 1 AND 16);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_badge_color_set;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_badge_color_set
  CHECK (badge_color IS NULL OR badge_color IN ('purple', 'blue', 'green', 'gold', 'red'));

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

  IF OLD.badge_score IS NULL
     AND auth.role() IS DISTINCT FROM 'service_role' THEN
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

CREATE OR REPLACE FUNCTION public.set_my_badge_look(p_label text, p_color text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_label text := NULLIF(btrim(COALESCE(p_label, '')), '');
  v_color text := NULLIF(btrim(COALESCE(p_color, '')), '');
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = v_uid AND badge_score IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You do not have a badge';
  END IF;
  IF v_label IS NOT NULL AND char_length(v_label) > 16 THEN
    RAISE EXCEPTION 'Badge text can be at most 16 characters';
  END IF;
  IF v_color IS NOT NULL AND v_color NOT IN ('purple', 'blue', 'green', 'gold', 'red') THEN
    RAISE EXCEPTION 'Pick a badge color';
  END IF;
  UPDATE public.profiles
  SET badge_label = v_label,
      badge_color = v_color
  WHERE id = v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.set_my_badge_look(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_my_badge_look(text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_badge_score(p_user_id uuid, p_score integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_score IS NOT NULL AND (p_score < 400 OR p_score > 1600) THEN
    RAISE EXCEPTION 'Score must be between 400 and 1600';
  END IF;
  UPDATE public.profiles
  SET badge_score = p_score,
      badge_label = CASE WHEN p_score IS NULL THEN NULL ELSE badge_label END,
      badge_color = CASE WHEN p_score IS NULL THEN NULL ELSE badge_color END
  WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;
END;
$$;

DROP VIEW IF EXISTS public.chat_directory;
CREATE VIEW public.chat_directory
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.telegram_username,
  p.telegram_connected_at,
  p.chat_setup_completed,
  p.class_id,
  p.full_name,
  p.first_name,
  p.last_name,
  p.badge_score,
  p.badge_label,
  p.badge_color
FROM public.profiles p
WHERE p.username IS NOT NULL
  AND p.chat_setup_completed IS TRUE
  AND p.banned IS NOT TRUE
  AND (
    public.bs_is_staff()
    OR p.id = auth.uid()
    OR public.bs_teaches_student(p.id)
    OR EXISTS (
      SELECT 1
      FROM public.class_group_memberships mine
      JOIN public.class_group_memberships theirs
        ON theirs.class_id = mine.class_id
       AND theirs.user_id = p.id
       AND theirs.status <> 'left'
      WHERE mine.user_id = auth.uid()
        AND mine.status <> 'left'
    )
    OR EXISTS (
      SELECT 1
      FROM public.class_group_memberships mine
      JOIN public.class_groups g ON g.id = mine.group_id
      WHERE mine.user_id = auth.uid()
        AND mine.status <> 'left'
        AND g.teacher_id = p.id
    )
  );

REVOKE ALL ON public.chat_directory FROM PUBLIC, anon;
GRANT SELECT ON public.chat_directory TO authenticated;

DROP FUNCTION IF EXISTS public.admin_users_summary();
CREATE FUNCTION public.admin_users_summary()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  username text,
  created_at timestamptz,
  last_seen_at timestamptz,
  banned boolean,
  role text,
  tests_total bigint,
  tests_mock bigint,
  tests_daily bigint,
  tests_practice bigint,
  current_streak integer,
  last_active_at timestamptz,
  class_name text,
  accuracy_pct integer,
  staff_created boolean,
  badge_score integer,
  badge_label text,
  badge_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.username,
    p.created_at,
    p.last_seen_at,
    coalesce(p.banned, false),
    public.admin_user_role(p.id),
    coalesce(ts.tests_total, 0),
    coalesce(ts.tests_mock, 0),
    coalesce(ts.tests_daily, 0),
    coalesce(ts.tests_practice, 0),
    coalesce(sp.current_streak, 0),
    sp.last_active_at,
    coalesce(memberships.class_name, c.name),
    CASE
      WHEN coalesce(att.att_total, 0) = 0 THEN NULL
      ELSE round(100.0 * att.att_correct / att.att_total)::integer
    END,
    coalesce(p.staff_created, false),
    p.badge_score,
    p.badge_label,
    p.badge_color
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT string_agg(cls.name, ', ' ORDER BY cls.name) AS class_name
    FROM public.class_memberships m
    JOIN public.classes cls ON cls.id = m.class_id
    WHERE m.user_id = p.id
  ) memberships ON true
  LEFT JOIN public.classes c ON c.id = p.class_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS tests_total,
      count(*) FILTER (WHERE s.type = 'mock')::bigint AS tests_mock,
      count(*) FILTER (WHERE s.type = 'daily')::bigint AS tests_daily,
      count(*) FILTER (WHERE s.type = 'practice')::bigint AS tests_practice
    FROM public.test_sessions s
    WHERE s.user_id = p.id
  ) ts ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE a.is_correct IS NOT NULL)::bigint AS att_total,
      count(*) FILTER (WHERE a.is_correct = true)::bigint AS att_correct
    FROM public.attempts a
    WHERE a.user_id = p.id
  ) att ON true
  WHERE (SELECT public.bs_is_admin())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_users_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261030000004', 'badge_look')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
