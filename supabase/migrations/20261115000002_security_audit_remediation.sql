-- Defensive security audit remediation:
-- 1. Treat held ("basket", deleted_at IS NOT NULL) accounts identically to banned
--    accounts in bs_is_self_banned(), role helpers, chat_directory, and Storage.
-- 2. Extend the restrictive "banned accounts blocked" policy to all tables created
--    after 20261014000001_ban_enforcement.sql.
-- 3. Restrict bs_lock_profile_security_columns() bypass to admins + service_role
--    (not editors), revoke GoTrue sessions on hold/ban, and block admin-on-admin bans.
-- 4. Prevent pre-session harvesting of Mock Exam / Test Base / published questions
--    and question images by scoping public.questions, mock_exam_sections,
--    mock_exam_questions, and question-images to staff or the student's own sessions/attempts.
-- 5. Restrict bs_upsert_lesson_video to staff and service_role with video ID validation.

-- ---------------------------------------------------------------------------
-- 1. Ban + soft-delete (basket) enforcement & role helper guards
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bs_is_self_banned()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT (COALESCE(p.banned, false) OR p.deleted_at IS NOT NULL)
      FROM public.profiles p
      WHERE p.id = auth.uid()
    ),
    false
  );
$$;

REVOKE ALL ON FUNCTION public.bs_is_self_banned() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_is_self_banned() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bs_is_admin(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false)
    AND NOT public.bs_is_self_banned()
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'admin')
    AND public.bs_admin_session_fresh();
$$;

CREATE OR REPLACE FUNCTION public.bs_is_editor(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false)
    AND NOT public.bs_is_self_banned()
    AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'editor')
    AND public.bs_admin_session_fresh();
$$;

CREATE OR REPLACE FUNCTION public.bs_is_staff(_uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false)
    AND NOT public.bs_is_self_banned()
    AND public.bs_admin_session_fresh()
    AND EXISTS (
      SELECT 1 FROM public.user_roles r
      WHERE r.user_id = _uid AND r.role IN ('admin', 'editor')
    );
$$;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_user_id = auth.uid(), false)
    AND NOT public.bs_is_self_banned()
    AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
    AND (_role NOT IN ('admin', 'editor') OR public.bs_admin_session_fresh());
$$;

-- Apply restrictive ban/hold block to every RLS-enabled public table (covers post-Oct-14 tables).
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity
      AND c.relname <> 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "banned accounts blocked" ON public.%I', r.relname);
    EXECUTE format(
      'CREATE POLICY "banned accounts blocked" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (NOT public.bs_is_self_banned()) WITH CHECK (NOT public.bs_is_self_banned())',
      r.relname
    );
  END LOOP;
END $$;

-- Exclude held accounts from chat_directory and block banned/held callers from querying it.
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
WHERE NOT public.bs_is_self_banned()
  AND p.username IS NOT NULL
  AND p.chat_setup_completed IS TRUE
  AND p.banned IS NOT TRUE
  AND p.deleted_at IS NULL
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

REVOKE ALL ON TABLE public.chat_directory FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.chat_directory TO authenticated, service_role;

-- Enforce ban/hold checks on avatars, chat-uploads, and homework-uploads buckets.
DROP POLICY IF EXISTS "avatars read auth" ON storage.objects;
CREATE POLICY "avatars read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND NOT public.bs_is_self_banned());

DROP POLICY IF EXISTS "avatars insert own" ON storage.objects;
CREATE POLICY "avatars insert own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND NOT public.bs_is_self_banned()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars update own" ON storage.objects;
CREATE POLICY "avatars update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND NOT public.bs_is_self_banned()
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND NOT public.bs_is_self_banned()
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avatars delete own or staff" ON storage.objects;
CREATE POLICY "avatars delete own or staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND NOT public.bs_is_self_banned()
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.bs_is_staff())
  );

DROP POLICY IF EXISTS "chat uploads read auth" ON storage.objects;
CREATE POLICY "chat uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND NOT public.bs_is_self_banned()
    AND public.bs_can_read_chat_object(name)
  );

DROP POLICY IF EXISTS "chat uploads write auth" ON storage.objects;
CREATE POLICY "chat uploads write auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-uploads'
    AND NOT public.bs_is_self_banned()
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "chat uploads update own" ON storage.objects;
CREATE POLICY "chat uploads update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND NOT public.bs_is_self_banned()
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff())
  )
  WITH CHECK (
    bucket_id = 'chat-uploads'
    AND NOT public.bs_is_self_banned()
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff())
  );

DROP POLICY IF EXISTS "chat uploads delete own" ON storage.objects;
CREATE POLICY "chat uploads delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-uploads'
    AND NOT public.bs_is_self_banned()
    AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff())
  );

DROP POLICY IF EXISTS "hw uploads read auth" ON storage.objects;
CREATE POLICY "hw uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'homework-uploads'
    AND NOT public.bs_is_self_banned()
    AND public.bs_can_read_homework_object(name)
  );

DROP POLICY IF EXISTS "hw uploads write auth" ON storage.objects;
CREATE POLICY "hw uploads write auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-uploads'
    AND NOT public.bs_is_self_banned()
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "hw uploads update" ON storage.objects;
CREATE POLICY "hw uploads update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-uploads'
    AND NOT public.bs_is_self_banned()
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'homework-uploads'
    AND NOT public.bs_is_self_banned()
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "hw uploads delete" ON storage.objects;
CREATE POLICY "hw uploads delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-uploads'
    AND NOT public.bs_is_self_banned()
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  );

-- ---------------------------------------------------------------------------
-- 2. Editor profile-column lock + GoTrue session revocation on hold/ban
-- ---------------------------------------------------------------------------

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

  IF NEW.badge_score IS NULL
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND NOT public.bs_is_admin() THEN
    NEW.badge_label := OLD.badge_label;
    NEW.badge_color := OLD.badge_color;
  END IF;

  IF NEW.telegram_admin_chat_id IS DISTINCT FROM OLD.telegram_admin_chat_id
     AND auth.role() IS DISTINCT FROM 'service_role'
     AND current_setting('beyondsat.telegram_link', true) IS DISTINCT FROM 'on' THEN
    NEW.telegram_admin_chat_id := OLD.telegram_admin_chat_id;
  END IF;

  -- Only service_role and admins bypass profile identity/credential column locks (not editors).
  IF auth.role() = 'service_role' OR public.bs_is_admin() THEN
    RETURN NEW;
  END IF;

  NEW.full_name := OLD.full_name;
  NEW.first_name := OLD.first_name;
  NEW.last_name := OLD.last_name;
  NEW.banned := OLD.banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;
  NEW.class_id := OLD.class_id;
  NEW.staff_created := OLD.staff_created;

  IF current_setting('beyondsat.clear_must_change', true) IS DISTINCT FROM 'on' THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
    NEW.email := OLD.email;
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

DROP TRIGGER IF EXISTS bs_profiles_lock_security_columns ON public.profiles;
CREATE TRIGGER bs_profiles_lock_security_columns
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.bs_lock_profile_security_columns();

CREATE OR REPLACE FUNCTION private.bs_revoke_user_sessions(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RETURN;
  END IF;
  BEGIN
    DELETE FROM auth.refresh_tokens WHERE user_id = p_user_id::text;
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
    NULL;
  END;
  BEGIN
    DELETE FROM auth.sessions WHERE user_id = p_user_id;
  EXCEPTION WHEN undefined_table OR insufficient_privilege THEN
    NULL;
  END;
END;
$$;

REVOKE ALL ON FUNCTION private.bs_revoke_user_sessions(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_hold_student(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account here.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_user_id
      AND r.role IN ('admin', 'editor', 'teacher', 'support_teacher')
  ) THEN
    RAISE EXCEPTION 'Only student accounts can be deleted here.';
  END IF;
  UPDATE public.profiles
  SET deleted_at = COALESCE(deleted_at, now())
  WHERE id = p_user_id
  RETURNING deleted_at INTO v_at;
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'Student not found.';
  END IF;
  PERFORM private.bs_revoke_user_sessions(p_user_id);
  RETURN v_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_hold_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hold_student(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_banned(
  p_user_id uuid,
  p_banned boolean,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Only admins can ban or unban users' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot ban yourself';
  END IF;
  IF p_banned AND EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_user_id AND r.role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Cannot ban another admin account' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET banned        = p_banned,
         banned_at     = CASE WHEN p_banned THEN now() ELSE NULL END,
         banned_reason = CASE WHEN p_banned THEN p_reason ELSE NULL END
   WHERE id = p_user_id;

  IF p_banned THEN
    PERFORM private.bs_revoke_user_sessions(p_user_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_banned(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_banned(uuid, boolean, text) TO authenticated;

-- ---------------------------------------------------------------------------
-- 3. Prevent pre-session harvesting of questions, mock mappings, and images
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.practice_counts()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  RETURN jsonb_build_object(
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section', q.section::text,
        'bank_format', q.bank_format,
        'difficulty', q.difficulty::text,
        'n', q.n
      ))
      FROM (
        SELECT section, bank_format, difficulty, count(*)::integer AS n
        FROM public.questions
        WHERE published IS TRUE
        GROUP BY section, bank_format, difficulty
      ) q
    ), '[]'::jsonb),
    'mocks', (SELECT count(*)::integer FROM public.mock_exams WHERE published IS TRUE),
    'sqb_tests', (
      SELECT count(*)::integer FROM public.tests
      WHERE bank_format = 'sqb' AND published IS TRUE AND in_test_base IS FALSE
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.practice_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_counts() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mock_exam_question_counts(p_mock_ids uuid[])
RETURNS TABLE (mock_exam_id uuid, question_count integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id AS mock_exam_id,
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.mock_exam_sections s
        WHERE s.mock_exam_id = m.id AND s.test_id IS NOT NULL
      ) THEN (
        SELECT count(*)::integer
        FROM public.mock_exam_sections s
        JOIN public.test_questions tq ON tq.test_id = s.test_id
        WHERE s.mock_exam_id = m.id AND s.test_id IS NOT NULL
      )
      ELSE (
        SELECT count(*)::integer
        FROM public.mock_exam_questions mq
        WHERE mq.mock_exam_id = m.id
      )
    END AS question_count
  FROM public.mock_exams m
  WHERE m.id = ANY (COALESCE(p_mock_ids, '{}'::uuid[]))
    AND (m.published IS TRUE OR public.bs_is_staff());
END;
$$;

REVOKE ALL ON FUNCTION public.mock_exam_question_counts(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mock_exam_question_counts(uuid[]) TO authenticated, service_role;

DROP POLICY IF EXISTS "mes read auth" ON public.mock_exam_sections;
DROP POLICY IF EXISTS "mes read staff" ON public.mock_exam_sections;
CREATE POLICY "mes read staff" ON public.mock_exam_sections
  FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Authenticated read mock_exam_questions" ON public.mock_exam_questions;
DROP POLICY IF EXISTS "Staff read mock_exam_questions" ON public.mock_exam_questions;
CREATE POLICY "Staff read mock_exam_questions" ON public.mock_exam_questions
  FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Authenticated read daily_tests" ON public.daily_tests;
DROP POLICY IF EXISTS "daily_tests read active or staff" ON public.daily_tests;
CREATE POLICY "daily_tests read active or staff" ON public.daily_tests
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR date <= ((now() AT TIME ZONE 'utc')::date + 1)
  );

DROP POLICY IF EXISTS "dtt read auth" ON public.daily_test_tests;
DROP POLICY IF EXISTS "dtt read staff" ON public.daily_test_tests;
CREATE POLICY "dtt read staff" ON public.daily_test_tests
  FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Authenticated read daily_test_questions" ON public.daily_test_questions;
DROP POLICY IF EXISTS "Staff read daily_test_questions" ON public.daily_test_questions;
CREATE POLICY "Staff read daily_test_questions" ON public.daily_test_questions
  FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "questions read published or staff" ON public.questions;
DROP POLICY IF EXISTS "questions read in session or staff" ON public.questions;
CREATE POLICY "questions read in session or staff"
  ON public.questions
  FOR SELECT
  TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.attempts a
      WHERE a.user_id = auth.uid()
        AND a.question_id = questions.id
    )
    OR EXISTS (
      SELECT 1
      FROM public.test_sessions s
      WHERE s.user_id = auth.uid()
        AND s.metadata->'question_ids' @> to_jsonb(questions.id::text)
    )
  );

CREATE OR REPLACE FUNCTION public.bs_can_read_question_image(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.bs_is_self_banned()
    AND (
      public.bs_is_staff()
      OR EXISTS (
        SELECT 1
        FROM public.questions q
        WHERE (
            q.image_url = _name
            OR strpos(coalesce(q.image_url, ''), _name) > 0
            OR strpos(q.choices::text, _name) > 0
          )
          AND (
            EXISTS (
              SELECT 1 FROM public.attempts a
              WHERE a.user_id = auth.uid() AND a.question_id = q.id
            )
            OR EXISTS (
              SELECT 1 FROM public.test_sessions s
              WHERE s.user_id = auth.uid()
                AND s.metadata->'question_ids' @> to_jsonb(q.id::text)
            )
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.bs_can_read_question_image(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_can_read_question_image(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "qimg read auth" ON storage.objects;
CREATE POLICY "qimg read auth"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND public.bs_can_read_question_image(objects.name)
  );

-- ---------------------------------------------------------------------------
-- 4. Lock lesson_video_catalog upserts to staff + service_role
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bs_upsert_lesson_video(
  p_video_id text,
  p_title text,
  p_youtube_url text,
  p_duration_seconds integer DEFAULT NULL::integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_is_service boolean := v_role = 'service_role'
    OR (auth.uid() IS NULL AND v_role = '' AND current_user IN ('postgres', 'supabase_admin', 'service_role'));
  vid text := nullif(trim(coalesce(p_video_id, '')), '');
  clean_title text := left(trim(coalesce(p_title, '')), 300);
BEGIN
  IF NOT v_is_service THEN
    IF auth.uid() IS NULL THEN
      RAISE EXCEPTION 'not authenticated' USING ERRCODE = '42501';
    END IF;
    IF public.bs_is_self_banned() THEN
      RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
    END IF;
    IF NOT public.bs_is_staff() THEN
      RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF vid IS NULL THEN
    vid := public.bs_youtube_video_id(p_youtube_url);
  END IF;
  IF vid IS NULL OR vid !~ '^[A-Za-z0-9_-]{6,20}$' OR clean_title = '' THEN
    RETURN;
  END IF;

  IF NOT v_is_service AND public.bs_is_staff() THEN
    INSERT INTO public.lesson_video_catalog AS c (
      youtube_video_id, title, youtube_url, duration_seconds
    )
    VALUES (
      vid,
      clean_title,
      'https://www.youtube.com/watch?v=' || vid,
      p_duration_seconds
    )
    ON CONFLICT (youtube_video_id) DO UPDATE
    SET
      title = EXCLUDED.title,
      youtube_url = EXCLUDED.youtube_url,
      duration_seconds = COALESCE(EXCLUDED.duration_seconds, c.duration_seconds);
  ELSE
    INSERT INTO public.lesson_video_catalog AS c (
      youtube_video_id, title, youtube_url, duration_seconds
    )
    VALUES (
      vid,
      clean_title,
      'https://www.youtube.com/watch?v=' || vid,
      p_duration_seconds
    )
    ON CONFLICT (youtube_video_id) DO UPDATE
    SET duration_seconds = COALESCE(c.duration_seconds, EXCLUDED.duration_seconds)
    WHERE c.duration_seconds IS NULL AND EXCLUDED.duration_seconds IS NOT NULL;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_upsert_lesson_video(text, text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_upsert_lesson_video(text, text, text, integer) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 5. Randomize legacy predictable <username>@accounts.beyondsat.local emails
--    and enforce internal SECURITY DEFINER function hygiene
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  r record;
  v_new_email text;
BEGIN
  PERFORM set_config('beyondsat.clear_must_change', 'on', true);
  FOR r IN
    SELECT u.id, u.email
    FROM auth.users u
    WHERE u.email ~* '^[a-z0-9_]+@accounts\.beyondsat\.local$'
  LOOP
    v_new_email := split_part(lower(r.email), '@', 1) || '.'
      || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
      || '@accounts.beyondsat.local';

    UPDATE auth.users
    SET email = v_new_email, updated_at = now()
    WHERE id = r.id;

    BEGIN
      UPDATE auth.identities
      SET identity_data = jsonb_set(identity_data, '{email}', to_jsonb(v_new_email)),
          updated_at = now()
      WHERE user_id = r.id
        AND provider = 'email'
        AND identity_data IS NOT NULL;
    EXCEPTION WHEN undefined_table OR undefined_column OR insufficient_privilege THEN
      NULL;
    END;

    UPDATE public.profiles
    SET email = v_new_email
    WHERE id = r.id;
  END LOOP;
  PERFORM set_config('beyondsat.clear_must_change', '', true);
END $$;

-- Pin search_path = public on every public SECURITY DEFINER function and revoke
-- client EXECUTE on all internal underscore/billing/autotick helper functions.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           p.proname,
           p.prosecdef,
           COALESCE(array_to_string(p.proconfig, ','), '') AS cfg
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    IF r.prosecdef AND r.cfg NOT LIKE '%search_path=public%' THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public', r.sig);
    END IF;

    IF r.proname ~ '^(_bs_|_billing_|_support_)'
       OR r.proname IN (
         'bs_counted_groups',
         'bs_subject_month_part',
         'bs_student_class_override',
         'bs_group_fee_for_month',
         'bs_join_month_charge',
         'bs_member_active_in_group_month',
         'bs_max_payment_uzs',
         'bs_sync_parent_membership',
         'bs_student_balance',
         'bs_var_autotick'
       ) THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
    END IF;
  END LOOP;
END $$;

UPDATE storage.buckets
SET public = false
WHERE id = 'linktree-icons';

-- ---------------------------------------------------------------------------
-- 6. Gate 2 Pentest Remediations (PT-01 through PT-06)
-- ---------------------------------------------------------------------------

-- PT-01: Enforce folder-prefix ownership on chat & homework attachment links
DROP POLICY IF EXISTS "msg attachments insert" ON public.chat_message_attachments;
CREATE POLICY "msg attachments insert" ON public.chat_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    split_part(storage_path, '/', 1) = auth.uid()::text
    AND position('..' in storage_path) = 0
    AND EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "hw sub files insert own" ON public.homework_submission_files;
CREATE POLICY "hw sub files insert own" ON public.homework_submission_files
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      split_part(storage_path, '/', 1) = auth.uid()::text
      AND position('..' in storage_path) = 0
      AND EXISTS (
        SELECT 1 FROM public.homework_submissions s
        WHERE s.id = submission_id AND s.student_id = auth.uid()
      )
    )
  );

-- PT-02: Lock completed_at, started_at, user_id, and immutable metadata in bs_test_sessions_guard,
--        and enforce server-side mock exam time limits (+ 5 minute grace) in submit_attempt.
CREATE OR REPLACE FUNCTION public.bs_test_sessions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rw_correct int;
  v_rw_total int;
  v_math_correct int;
  v_math_total int;
  v_strip constant text[] := ARRAY['draft_answers', 'mock_phase', 'mock_time_left', 'mock_idx', 'phase_ends_at'];
BEGIN
  IF current_setting('beyondsat.server_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    RAISE EXCEPTION 'Sessions are created server-side';
  END IF;

  IF OLD.completed_at IS NOT NULL THEN
    RAISE EXCEPTION 'Completed sessions cannot be modified';
  END IF;

  IF NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.started_at IS DISTINCT FROM OLD.started_at
     OR NEW.type IS DISTINCT FROM OLD.type
     OR NEW.mock_exam_id IS DISTINCT FROM OLD.mock_exam_id
     OR NEW.daily_test_id IS DISTINCT FROM OLD.daily_test_id THEN
    RAISE EXCEPTION 'Session identity cannot be changed';
  END IF;

  IF (COALESCE(NEW.metadata, '{}'::jsonb) - v_strip)
     IS DISTINCT FROM (COALESCE(OLD.metadata, '{}'::jsonb) - v_strip) THEN
    RAISE EXCEPTION 'Session question set cannot be changed';
  END IF;

  IF NEW.completed_at IS NULL THEN
    IF NEW.score IS DISTINCT FROM OLD.score
       OR NEW.rw_score IS DISTINCT FROM OLD.rw_score
       OR NEW.math_score IS DISTINCT FROM OLD.math_score
       OR NEW.correct_count IS DISTINCT FROM OLD.correct_count
       OR NEW.total_questions IS DISTINCT FROM OLD.total_questions THEN
      RAISE EXCEPTION 'Session results are computed server-side';
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    count(*) FILTER (WHERE a.is_correct AND q.section = 'reading_writing'),
    count(*) FILTER (WHERE q.section = 'reading_writing'),
    count(*) FILTER (WHERE a.is_correct AND q.section = 'math'),
    count(*) FILTER (WHERE q.section = 'math')
  INTO v_rw_correct, v_rw_total, v_math_correct, v_math_total
  FROM jsonb_array_elements_text(COALESCE(OLD.metadata->'question_ids', '[]'::jsonb)) AS qid(q)
  LEFT JOIN public.questions q ON q.id = qid.q::uuid
  LEFT JOIN public.attempts a
    ON a.question_id = qid.q::uuid AND a.session_id = OLD.id;

  IF COALESCE(NEW.correct_count, 0)
       <> COALESCE(v_rw_correct, 0) + COALESCE(v_math_correct, 0) THEN
    RAISE EXCEPTION 'Session results are computed server-side';
  END IF;
  IF COALESCE(NEW.total_questions, 0)
       <> COALESCE(v_rw_total, 0) + COALESCE(v_math_total, 0) THEN
    RAISE EXCEPTION 'Session results are computed server-side';
  END IF;
  IF NEW.type = 'mock' THEN
    IF COALESCE(NEW.rw_score, 0) <> COALESCE(public.bs_scale_section('reading_writing', v_rw_correct, v_rw_total), 0)
       OR COALESCE(NEW.math_score, 0) <> COALESCE(public.bs_scale_section('math', v_math_correct, v_math_total), 0)
       OR COALESCE(NEW.score, 0) <> COALESCE(public.bs_scale_section('reading_writing', v_rw_correct, v_rw_total), 0)
            + COALESCE(public.bs_scale_section('math', v_math_correct, v_math_total), 0) THEN
      RAISE EXCEPTION 'Session results are computed server-side';
    END IF;
  ELSE
    IF COALESCE(NEW.score, 0) <> COALESCE(NEW.correct_count, 0) THEN
      RAISE EXCEPTION 'Session results are computed server-side';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_attempt(
  p_session_id uuid,
  p_question_id uuid,
  p_choice_id text,
  p_grid_answer text,
  p_marked_for_review boolean DEFAULT false,
  p_eliminated text[] DEFAULT NULL::text[],
  p_time_spent integer DEFAULT NULL::integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_type public.test_type;
  v_started timestamptz;
  v_mock_id uuid;
  v_max_seconds integer;
  v_correct boolean;
  v_stored boolean;
  v_kind public.question_kind;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  SELECT s.type, s.started_at, s.mock_exam_id
    INTO v_type, v_started, v_mock_id
  FROM public.test_sessions s
  WHERE s.id = p_session_id
    AND s.user_id = v_uid
    AND s.completed_at IS NULL
    AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text);

  IF v_type IS NULL THEN
    RAISE EXCEPTION 'Question is not in an active session';
  END IF;

  IF v_type = 'mock' AND v_mock_id IS NOT NULL AND v_started IS NOT NULL AND NOT public.bs_is_staff() THEN
    SELECT
      COALESCE(m.rw_module1_time_seconds, 1920)
      + COALESCE(m.rw_module2_time_seconds, 1920)
      + COALESCE(m.math_module1_time_seconds, 2100)
      + COALESCE(m.math_module2_time_seconds, 2100)
      + COALESCE(m.section_break_seconds, 1200)
      + 300
    INTO v_max_seconds
    FROM public.mock_exams m
    WHERE m.id = v_mock_id;

    IF v_max_seconds IS NOT NULL AND now() > v_started + make_interval(secs => v_max_seconds) THEN
      RAISE EXCEPTION 'Mock exam time has expired';
    END IF;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_session_id::text || ':' || p_question_id::text, 0)
  );

  SELECT a.is_correct INTO v_stored
  FROM public.attempts a
  WHERE a.session_id = p_session_id AND a.question_id = p_question_id;
  IF v_stored IS NOT NULL THEN
    RETURN CASE WHEN v_type = 'mock' THEN NULL ELSE v_stored END;
  END IF;

  SELECT kind INTO v_kind FROM public.questions WHERE id = p_question_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Question not found';
  END IF;

  IF v_kind = 'grid_in' THEN
    v_correct := COALESCE(public.grade_answer(p_question_id, NULL, p_grid_answer, p_session_id), false);
  ELSE
    v_correct := COALESCE(public.grade_answer(p_question_id, p_choice_id, NULL, p_session_id), false);
  END IF;

  INSERT INTO public.attempts (
    user_id, session_id, question_id, test_type, selected_choice_id,
    grid_answer, is_correct, marked_for_review, eliminated_choice_ids,
    time_spent_seconds
  )
  VALUES (
    v_uid, p_session_id, p_question_id, v_type, p_choice_id,
    NULLIF(p_grid_answer, ''), v_correct, COALESCE(p_marked_for_review, false),
    COALESCE(p_eliminated, ARRAY[]::text[]), p_time_spent
  )
  ON CONFLICT (session_id, question_id) DO NOTHING;

  IF v_type = 'mock' THEN
    RETURN NULL;
  END IF;
  RETURN v_correct;
END;
$$;

-- PT-03: Deduplicate question IDs and enforce quiz visibility inside submit_vocab_quiz
CREATE OR REPLACE FUNCTION public.submit_vocab_quiz(
  p_quiz_id uuid,
  p_question_ids uuid[],
  p_selected text[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_q public.vocab_quiz_questions%ROWTYPE;
  v_results jsonb := '[]'::jsonb;
  v_missed uuid[] := ARRAY[]::uuid[];
  v_score int := 0;
  v_total int;
  v_count int;
  v_submitted int;
  v_distinct int;
  v_correct boolean;
  v_i int;
  v_hw record;
  v_period text;
  v_tashkent date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.vocab_quizzes qz
    WHERE qz.id = p_quiz_id
      AND (
        qz.visibility = 'published'
        OR qz.owner_id = v_uid
        OR public.bs_is_staff()
      )
  ) THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;

  v_submitted := coalesce(array_length(p_question_ids, 1), 0);
  IF v_submitted = 0 THEN
    RAISE EXCEPTION 'Answers required';
  END IF;

  SELECT count(DISTINCT x) INTO v_distinct
  FROM unnest(p_question_ids) AS x;
  IF v_distinct <> v_submitted THEN
    RAISE EXCEPTION 'Duplicate question in answers';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.vocab_quiz_attempts
  WHERE user_id = v_uid AND quiz_id = p_quiz_id
    AND created_at > now() - interval '10 seconds';
  IF v_count > 0 THEN
    RETURN jsonb_build_object('error', 'already-submitted');
  END IF;

  SELECT count(*) INTO v_count
  FROM public.vocab_quiz_attempts
  WHERE user_id = v_uid AND quiz_id = p_quiz_id
    AND created_at > now() - interval '24 hours';
  IF v_count >= 25 THEN
    RETURN jsonb_build_object('error', 'too-many-attempts');
  END IF;

  SELECT count(*) INTO v_total FROM public.vocab_quiz_questions WHERE quiz_id = p_quiz_id;
  IF v_total = 0 THEN
    RAISE EXCEPTION 'Quiz not found';
  END IF;
  IF v_submitted > v_total THEN
    RAISE EXCEPTION 'Too many answers for this quiz';
  END IF;

  FOR v_i IN 1..v_submitted LOOP
    SELECT * INTO v_q
    FROM public.vocab_quiz_questions
    WHERE id = p_question_ids[v_i] AND quiz_id = p_quiz_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Question is not part of this quiz';
    END IF;

    v_correct := lower(btrim(coalesce(p_selected[v_i], ''))) = lower(btrim(v_q.correct_answer));
    IF v_correct THEN
      v_score := v_score + 1;
    ELSIF v_q.vocab_card_id IS NOT NULL THEN
      v_missed := array_append(v_missed, v_q.vocab_card_id);
    END IF;

    v_results := v_results || jsonb_build_object(
      'questionId', v_q.id,
      'correct', v_correct,
      'correctAnswer', v_q.correct_answer,
      'explanation', v_q.explanation
    );
  END LOOP;

  INSERT INTO public.vocab_quiz_attempts (user_id, quiz_id, score, total)
  VALUES (v_uid, p_quiz_id, v_score, v_total);

  IF v_total > 0 AND v_score >= v_total THEN
    FOR v_hw IN
      SELECT a.id, a.recurrence
      FROM public.vocab_homework_assignments a
      WHERE a.target_type = 'quiz'
        AND a.quiz_id = p_quiz_id
        AND a.active
        AND a.starts_at <= now()
        AND (a.ends_at IS NULL OR a.ends_at >= now())
        AND (
          a.audience_type = 'all'
          OR (a.audience_type = 'class' AND public.bs_is_class_member(a.class_id, v_uid))
          OR (a.audience_type = 'users' AND public.bs_is_vocab_homework_assigned(a.id, v_uid))
        )
    LOOP
      v_period := CASE v_hw.recurrence
        WHEN 'once' THEN 'once'
        WHEN 'daily' THEN to_char(v_tashkent, 'YYYY-MM-DD')
        ELSE to_char(v_tashkent, 'IYYY-"W"IW')
      END;
      INSERT INTO public.vocab_homework_completions (
        assignment_id, user_id, period_key, quiz_score, quiz_total, status, completed_at
      )
      VALUES (v_hw.id, v_uid, v_period, v_score, v_total, 'completed', now())
      ON CONFLICT (assignment_id, user_id, period_key) DO UPDATE
        SET quiz_score = EXCLUDED.quiz_score,
            quiz_total = EXCLUDED.quiz_total,
            status = 'completed',
            completed_at = COALESCE(public.vocab_homework_completions.completed_at, now());
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percent', round(100.0 * v_score / v_total)::int,
    'missed_card_ids', to_jsonb(v_missed),
    'results', v_results
  );
END;
$$;

-- PT-04: Server-only (service_role) vocab activity + deck homework RPCs, and revoke client EXECUTE
CREATE OR REPLACE FUNCTION public.bs_record_vocab_activity_for_user(
  p_user_id uuid,
  p_cards integer DEFAULT 1
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_is_service boolean := v_role = 'service_role'
    OR (auth.uid() IS NULL AND v_role = '' AND current_user IN ('postgres', 'supabase_admin', 'service_role'));
  v_today date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_first boolean;
  v_last date;
  v_streak integer;
  v_longest integer;
  v_cards integer := LEAST(GREATEST(COALESCE(p_cards, 1), 0), 50);
BEGIN
  IF NOT v_is_service THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  INSERT INTO public.vocab_activity_logs (user_id, activity_date, cards_reviewed, completed_at)
  VALUES (p_user_id, v_today, v_cards, now())
  ON CONFLICT (user_id, activity_date) DO UPDATE
    SET cards_reviewed = public.vocab_activity_logs.cards_reviewed + excluded.cards_reviewed,
        completed_at = excluded.completed_at
  RETURNING (xmax = 0) INTO v_first;

  SELECT (last_active_at AT TIME ZONE 'Asia/Tashkent')::date, current_streak, longest_streak
    INTO v_last, v_streak, v_longest
  FROM public.student_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('first_today', v_first);
  END IF;

  PERFORM set_config('beyondsat.streak_write', 'on', true);

  IF v_first THEN
    IF v_last = v_today THEN
      v_streak := greatest(coalesce(v_streak, 1), 1);
    ELSIF v_last = v_today - 1 THEN
      v_streak := coalesce(v_streak, 0) + 1;
    ELSE
      v_streak := 1;
    END IF;
    UPDATE public.student_profiles
    SET last_active_at = now(),
        current_streak = v_streak,
        longest_streak = greatest(coalesce(v_longest, 0), v_streak)
    WHERE user_id = p_user_id;
  ELSE
    UPDATE public.student_profiles SET last_active_at = now() WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object('first_today', v_first, 'streak', v_streak);
END;
$$;

REVOKE ALL ON FUNCTION public.bs_record_vocab_activity_for_user(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_record_vocab_activity_for_user(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.bs_bump_vocab_homework_for_user(
  p_user_id uuid,
  p_assignment_id uuid,
  p_period_key text,
  p_green boolean
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := COALESCE(auth.role(), '');
  v_is_service boolean := v_role = 'service_role'
    OR (auth.uid() IS NULL AND v_role = '' AND current_user IN ('postgres', 'supabase_admin', 'service_role'));
  v_target integer;
  v_green_only boolean;
  v_row public.vocab_homework_completions;
BEGIN
  IF NOT v_is_service THEN
    RAISE EXCEPTION 'Service role required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT coalesce(a.card_target, 1), a.require_green_only
    INTO v_target, v_green_only
  FROM public.vocab_homework_assignments a
  WHERE a.id = p_assignment_id
    AND a.target_type = 'deck'
    AND a.active
    AND a.starts_at <= now()
    AND (a.ends_at IS NULL OR a.ends_at >= now())
    AND (
      a.audience_type = 'all'
      OR (
        a.audience_type = 'class'
        AND EXISTS (
          SELECT 1 FROM public.class_memberships m
          WHERE m.class_id = a.class_id AND m.user_id = p_user_id
        )
      )
      OR (
        a.audience_type = 'users'
        AND EXISTS (
          SELECT 1 FROM public.vocab_homework_assignment_users ahu
          WHERE ahu.assignment_id = a.id AND ahu.user_id = p_user_id
        )
      )
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not assigned' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vocab_homework_completions
    (assignment_id, user_id, period_key, cards_reviewed, green_reviews, status)
  VALUES (p_assignment_id, p_user_id, p_period_key, 1, CASE WHEN p_green THEN 1 ELSE 0 END, 'in_progress')
  ON CONFLICT (assignment_id, user_id, period_key) DO UPDATE
    SET cards_reviewed = public.vocab_homework_completions.cards_reviewed + 1,
        green_reviews = public.vocab_homework_completions.green_reviews
          + CASE WHEN p_green THEN 1 ELSE 0 END
  RETURNING * INTO v_row;

  IF v_row.status <> 'completed'
     AND v_row.cards_reviewed >= v_target
     AND (NOT v_green_only OR v_row.green_reviews = v_row.cards_reviewed) THEN
    UPDATE public.vocab_homework_completions
    SET status = 'completed', completed_at = now()
    WHERE id = v_row.id
    RETURNING * INTO v_row;
  END IF;

  RETURN jsonb_build_object(
    'cards_reviewed', v_row.cards_reviewed,
    'green_reviews', v_row.green_reviews,
    'status', v_row.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.bs_bump_vocab_homework_for_user(uuid, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_bump_vocab_homework_for_user(uuid, uuid, text, boolean) TO service_role;

REVOKE ALL ON FUNCTION public.bs_record_vocab_activity(integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_record_vocab_activity(integer) TO service_role;

REVOKE ALL ON FUNCTION public.bs_bump_vocab_homework(uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bs_bump_vocab_homework(uuid, text, boolean) TO service_role;

-- PT-05: Tighten editor / teacher boundaries on student phones, uinfo, and payment_collect_notes
DROP POLICY IF EXISTS "student contacts staff read" ON public.student_contacts;
CREATE POLICY "student contacts staff read" ON public.student_contacts
  FOR SELECT TO authenticated
  USING (public.bs_is_admin() OR user_id = auth.uid());

REVOKE SELECT (phone, parent_phone) ON public.students FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_list_students(p_search text DEFAULT '')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  parent_phone text,
  grade text,
  english_note text,
  math_note text,
  goal text,
  claimed_at timestamptz,
  username text,
  class_id uuid,
  class_name text,
  class_ids uuid[]
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := btrim(COALESCE(p_search, ''));
  v_is_admin boolean := public.bs_is_admin();
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.full_name,
    CASE WHEN v_is_admin THEN s.phone ELSE NULL END,
    CASE WHEN v_is_admin THEN s.parent_phone ELSE NULL END,
    s.grade,
    s.english_note,
    s.math_note,
    s.goal,
    s.claimed_at,
    p.username,
    classes.class_id,
    classes.class_name,
    COALESCE(classes.class_ids, ARRAY[]::uuid[])
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN LATERAL (
    SELECT
      (array_agg(m.class_id ORDER BY c.name))[1] AS class_id,
      string_agg(c.name, ', ' ORDER BY c.name) AS class_name,
      array_agg(m.class_id ORDER BY c.name) AS class_ids
    FROM public.class_memberships m
    JOIN public.classes c ON c.id = m.class_id
    WHERE m.user_id = s.user_id
  ) classes ON true
  WHERE v_search = ''
     OR s.full_name ILIKE '%' || v_search || '%'
     OR (v_is_admin AND COALESCE(s.phone, '') ILIKE '%' || v_search || '%')
     OR COALESCE(p.username, '') ILIKE v_search || '%'
  ORDER BY s.full_name
  LIMIT 400;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_students(text) TO authenticated, service_role;

DROP POLICY IF EXISTS "Staff read uinfo log" ON public.uinfo_log;
CREATE POLICY "Staff read uinfo log"
  ON public.uinfo_log FOR SELECT TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "Staff delete uinfo log" ON public.uinfo_log;
CREATE POLICY "Staff delete uinfo log"
  ON public.uinfo_log FOR DELETE TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "Staff read uinfo" ON public.uinfo;
CREATE POLICY "Staff read uinfo"
  ON public.uinfo FOR SELECT TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "Staff write uinfo" ON public.uinfo;
CREATE POLICY "Staff write uinfo"
  ON public.uinfo FOR ALL TO authenticated
  USING (public.bs_is_admin())
  WITH CHECK (public.bs_is_admin());

DROP POLICY IF EXISTS "collect notes staff" ON public.payment_collect_notes;
CREATE POLICY "collect notes staff" ON public.payment_collect_notes
  FOR ALL TO authenticated
  USING (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = payment_collect_notes.class_id
        AND public.bs_teaches_group(g.id)
    )
  )
  WITH CHECK (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = payment_collect_notes.class_id
        AND public.bs_teaches_group(g.id)
    )
  );

-- PT-06: Restore ban/hold checks in support booking RPCs and drop direct chat_threads insert policy
DROP POLICY IF EXISTS "threads insert direct" ON public.chat_threads;

CREATE OR REPLACE FUNCTION public.student_book_support_window(
  p_window_id uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_windows%ROWTYPE;
  v_day date;
  v_session uuid;
  v_name text;
  v_when text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF NOT public.support_booking_on() THEN
    RAISE EXCEPTION 'Student booking is turned off';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_uid AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can book support';
  END IF;
  PERFORM public.support_prepare_windows(14);
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL OR v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now() THEN
    RAISE EXCEPTION 'That slot is already taken';
  END IF;
  PERFORM public._support_require_subject(v_row.teacher_id, p_subject);
  v_day := (v_row.starts_at AT TIME ZONE 'Asia/Tashkent')::date;
  PERFORM pg_advisory_xact_lock(hashtext(v_uid::text), hashtext(v_day::text));
  IF EXISTS (
    SELECT 1
    FROM public.support_sessions s
    WHERE s.student_id = v_uid
      AND s.status IN ('pending', 'confirmed')
      AND COALESCE(s.preferred_on, (s.starts_at AT TIME ZONE 'Asia/Tashkent')::date) = v_day
  ) THEN
    RAISE EXCEPTION 'You already have support that day';
  END IF;
  v_session := public._support_session_for_window(p_window_id, v_uid, p_subject, 'request', 'confirmed');
  SELECT COALESCE(NULLIF(btrim(full_name), ''), 'A student') INTO v_name
  FROM public.profiles WHERE id = v_uid;
  v_when := to_char(v_row.starts_at AT TIME ZONE 'Asia/Tashkent', 'Dy FMDD Mon, HH24:MI');
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    v_name || ' booked ' || v_when || '.',
    '/admin/support',
    v_session
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.support_teacher_slots(p_teacher uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF NOT public.support_booking_on() THEN
    RETURN '[]'::jsonb;
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.starts_at)
    FROM (
      SELECT w.id, w.starts_at, w.ends_at,
        CASE
          WHEN public._support_on_break(w.teacher_id, w.starts_at, w.ends_at) THEN 'break'
          WHEN w.student_id IS NULL THEN 'free'
          WHEN w.student_id = v_uid THEN 'mine'
          ELSE 'taken'
        END AS state
      FROM public.support_windows w
      WHERE w.teacher_id = p_teacher
        AND w.closed = false
        AND w.starts_at > now() - interval '12 hours'
        AND w.starts_at < now() + interval '21 days'
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.support_teacher_directory()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x) ORDER BY x.name)
    FROM (
      SELECT DISTINCT p.id,
        COALESCE(p.full_name, p.username, 'Teacher') AS name,
        ss.subject
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.id
      JOIN public.support_subjects ss ON ss.teacher_id = p.id
      WHERE ur.role::text = 'support_teacher'
    ) x
  ), '[]'::jsonb);
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261115000002', 'security_audit_remediation')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
