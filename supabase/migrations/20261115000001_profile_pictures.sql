-- One profile picture per account, stored in a private `avatars` bucket that every
-- signed-in user can read. The photo path in profiles.avatar_url is locked to the
-- owner's own folder, so nobody can store an external URL or someone else's file.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bio text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_bio_len;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_bio_len CHECK (bio IS NULL OR char_length(bio) <= 70);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avatars', 'avatars', false, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
ON CONFLICT (id) DO UPDATE
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'],
    public = false;

DROP POLICY IF EXISTS "avatars read auth" ON storage.objects;
CREATE POLICY "avatars read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
CREATE POLICY "avatars insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "avatars delete own or staff" ON storage.objects;
CREATE POLICY "avatars delete own or staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.bs_is_staff())
  );

-- avatar_url may only be empty or `{own id}/avatar-<token>.(webp|jpg|jpeg|png)`.
-- A value a row already holds is left alone until it changes, so old photos keep working.
CREATE OR REPLACE FUNCTION public.profiles_lock_avatar_url()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.avatar_url IS NOT DISTINCT FROM OLD.avatar_url THEN
    RETURN NEW;
  END IF;
  IF NEW.avatar_url IS NULL OR btrim(NEW.avatar_url) = '' THEN
    NEW.avatar_url := NULL;
    RETURN NEW;
  END IF;
  IF NEW.avatar_url !~ ('^' || NEW.id::text || '/avatar-[A-Za-z0-9_-]{6,64}\.(webp|jpg|jpeg|png)$') THEN
    RAISE EXCEPTION 'Invalid profile picture path' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_lock_avatar_url ON public.profiles;
CREATE TRIGGER profiles_lock_avatar_url
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_lock_avatar_url();

CREATE OR REPLACE FUNCTION public.staff_remove_avatar(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles SET avatar_url = NULL WHERE id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_remove_avatar(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_remove_avatar(uuid) TO authenticated;

-- The purge now reports which accounts it removed so their photos can go too.
DROP FUNCTION IF EXISTS public.purge_settled_student_accounts();
CREATE FUNCTION public.purge_settled_student_accounts()
RETURNS uuid[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_removed uuid[] := ARRAY[]::uuid[];
BEGIN
  PERFORM set_config('bs.purge_account', 'on', true);
  FOR v_id IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= now() - interval '14 days'
      AND public.bs_student_balance(p.id) = 0
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_id;
      v_removed := v_removed || v_id;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not remove %: %', v_id, SQLERRM;
    END;
  END LOOP;
  PERFORM set_config('bs.purge_account', '', true);
  RETURN v_removed;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_settled_student_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_settled_student_accounts() TO service_role;

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
  badge_color text,
  avatar_url text
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
    p.badge_color,
    p.avatar_url
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
  WHERE p.deleted_at IS NULL
    AND (SELECT public.bs_is_admin())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_users_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261115000001', 'profile_pictures')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
