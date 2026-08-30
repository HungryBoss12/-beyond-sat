-- Admin user insights + Telegram admin linking

-- ---------------------------------------------------------------------------
-- Telegram admin link on profiles
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telegram_admin_chat_id bigint;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_telegram_admin_chat_id_uidx
  ON public.profiles (telegram_admin_chat_id)
  WHERE telegram_admin_chat_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.admin_telegram_link_codes (
  code text PRIMARY KEY,
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_telegram_link_codes_admin_idx
  ON public.admin_telegram_link_codes (admin_user_id, created_at DESC);

ALTER TABLE public.admin_telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins manage own link codes" ON public.admin_telegram_link_codes
  FOR ALL TO authenticated
  USING (admin_user_id = auth.uid() AND public.bs_is_admin())
  WITH CHECK (admin_user_id = auth.uid() AND public.bs_is_admin());

-- ---------------------------------------------------------------------------
-- Admin read access to vocab per-user data
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "admins read all user_card_states" ON public.user_card_states;
CREATE POLICY "admins read all user_card_states" ON public.user_card_states
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "admins read all vocab_quiz_attempts" ON public.vocab_quiz_attempts;
CREATE POLICY "admins read all vocab_quiz_attempts" ON public.vocab_quiz_attempts
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "admins read all vocab_activity_logs" ON public.vocab_activity_logs;
CREATE POLICY "admins read all vocab_activity_logs" ON public.vocab_activity_logs
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

-- ---------------------------------------------------------------------------
-- Helper: resolve role label
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_role(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'admin'::public.app_role
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = p_user_id AND ur.role = 'editor'::public.app_role
    ) THEN 'editor'
    ELSE 'student'
  END;
$$;

-- ---------------------------------------------------------------------------
-- List view: enriched user rows
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_users_summary()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
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
  accuracy_pct integer
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
    c.name,
    CASE
      WHEN coalesce(att.att_total, 0) = 0 THEN NULL
      ELSE round(100.0 * att.att_correct / att.att_total)::integer
    END
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
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
  ORDER BY p.created_at DESC
  LIMIT 500;
$$;

-- ---------------------------------------------------------------------------
-- Detail overview JSON
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can view user details';
  END IF;

  SELECT jsonb_build_object(
    'profile', to_jsonb(p.*) - 'telegram_admin_chat_id',
    'student_profile', to_jsonb(sp.*),
    'role', public.admin_user_role(p.id),
    'class_name', c.name,
    'stats', jsonb_build_object(
      'tests_total', coalesce(ts.tests_total, 0),
      'tests_mock', coalesce(ts.tests_mock, 0),
      'tests_daily', coalesce(ts.tests_daily, 0),
      'tests_practice', coalesce(ts.tests_practice, 0),
      'tests_completed', coalesce(ts.tests_completed, 0),
      'tests_in_progress', coalesce(ts.tests_in_progress, 0),
      'best_mock_score', ts.best_mock_score,
      'accuracy_pct', CASE
        WHEN coalesce(att.att_total, 0) = 0 THEN NULL
        ELSE round(100.0 * att.att_correct / att.att_total)::integer
      END,
      'attempts_total', coalesce(att.att_total, 0),
      'vocab_cards', coalesce(vc.card_count, 0),
      'vocab_due', coalesce(vc.due_count, 0),
      'vocab_quiz_attempts', coalesce(vq.quiz_count, 0),
      'vocab_reviews_7d', coalesce(va.reviews_7d, 0)
    )
  )
  INTO result
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN public.classes c ON c.id = p.class_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS tests_total,
      count(*) FILTER (WHERE s.type = 'mock')::bigint AS tests_mock,
      count(*) FILTER (WHERE s.type = 'daily')::bigint AS tests_daily,
      count(*) FILTER (WHERE s.type = 'practice')::bigint AS tests_practice,
      count(*) FILTER (WHERE s.completed_at IS NOT NULL)::bigint AS tests_completed,
      count(*) FILTER (WHERE s.completed_at IS NULL)::bigint AS tests_in_progress,
      max(s.score) FILTER (WHERE s.type = 'mock' AND s.score IS NOT NULL) AS best_mock_score
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
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS card_count,
      count(*) FILTER (WHERE ucs.due <= now())::bigint AS due_count
    FROM public.user_card_states ucs
    WHERE ucs.user_id = p.id
  ) vc ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::bigint AS quiz_count
    FROM public.vocab_quiz_attempts vqa
    WHERE vqa.user_id = p.id
  ) vq ON true
  LEFT JOIN LATERAL (
    SELECT coalesce(sum(val.cards_reviewed), 0)::bigint AS reviews_7d
    FROM public.vocab_activity_logs val
    WHERE val.user_id = p.id
      AND val.activity_date >= (current_date - 7)
  ) va ON true
  WHERE p.id = p_user_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- User sessions with resolved titles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_sessions(
  p_user_id uuid,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  type text,
  title text,
  started_at timestamptz,
  completed_at timestamptz,
  score integer,
  rw_score integer,
  math_score integer,
  correct_count integer,
  total_questions integer,
  in_progress boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.type::text,
    coalesce(
      me.title,
      dt.title,
      t.title,
      CASE s.type
        WHEN 'mock' THEN 'Mock exam'
        WHEN 'daily' THEN 'Daily test'
        ELSE 'Practice set'
      END
    ) AS title,
    s.started_at,
    s.completed_at,
    s.score,
    s.rw_score,
    s.math_score,
    s.correct_count,
    s.total_questions,
    (s.completed_at IS NULL) AS in_progress
  FROM public.test_sessions s
  LEFT JOIN public.mock_exams me ON me.id = s.mock_exam_id
  LEFT JOIN public.daily_tests dt ON dt.id = s.daily_test_id
  LEFT JOIN public.tests t ON t.id = (s.metadata->>'test_id')::uuid
  WHERE public.bs_is_admin()
    AND s.user_id = p_user_id
  ORDER BY coalesce(s.completed_at, s.started_at) DESC
  LIMIT greatest(p_limit, 1)
  OFFSET greatest(p_offset, 0);
$$;

-- ---------------------------------------------------------------------------
-- Unified activity timeline
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_user_activity(
  p_user_id uuid,
  p_limit integer DEFAULT 80
)
RETURNS TABLE (
  occurred_at timestamptz,
  kind text,
  summary text,
  meta jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.occurred_at, e.kind, e.summary, e.meta
  FROM (
    SELECT
      s.completed_at AS occurred_at,
      'test_completed'::text AS kind,
      initcap(s.type::text) || ' completed' AS summary,
      jsonb_build_object(
        'session_id', s.id,
        'type', s.type,
        'score', s.score,
        'title', coalesce(me.title, dt.title, t.title)
      ) AS meta
    FROM public.test_sessions s
    LEFT JOIN public.mock_exams me ON me.id = s.mock_exam_id
    LEFT JOIN public.daily_tests dt ON dt.id = s.daily_test_id
    LEFT JOIN public.tests t ON t.id = (s.metadata->>'test_id')::uuid
    WHERE s.user_id = p_user_id AND s.completed_at IS NOT NULL

    UNION ALL

    SELECT
      s.started_at,
      'test_started',
      initcap(s.type::text) || ' started',
      jsonb_build_object('session_id', s.id, 'type', s.type)
    FROM public.test_sessions s
    WHERE s.user_id = p_user_id

    UNION ALL

    SELECT
      vqa.created_at,
      'vocab_quiz',
      'Vocab quiz · ' || vqa.score::text || '/' || vqa.total::text,
      jsonb_build_object('quiz_id', vqa.quiz_id, 'score', vqa.score, 'total', vqa.total)
    FROM public.vocab_quiz_attempts vqa
    WHERE vqa.user_id = p_user_id

    UNION ALL

    SELECT
      val.completed_at,
      'vocab_review',
      'Vocab review · ' || val.cards_reviewed::text || ' cards',
      jsonb_build_object('activity_date', val.activity_date, 'cards_reviewed', val.cards_reviewed)
    FROM public.vocab_activity_logs val
    WHERE val.user_id = p_user_id
      AND val.cards_reviewed > 0

    UNION ALL

    SELECT
      p.banned_at,
      CASE WHEN p.banned THEN 'banned' ELSE 'unbanned' END,
      CASE WHEN p.banned THEN 'Account banned' ELSE 'Account unbanned' END,
      jsonb_build_object('reason', p.banned_reason)
    FROM public.profiles p
    WHERE p.id = p_user_id AND p.banned_at IS NOT NULL
  ) e
  WHERE public.bs_is_admin()
  ORDER BY e.occurred_at DESC NULLS LAST
  LIMIT greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- Telegram link codes (web admin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_create_telegram_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create Telegram link codes';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

  INSERT INTO public.admin_telegram_link_codes (code, admin_user_id, expires_at)
  VALUES (v_code, auth.uid(), now() + interval '10 minutes');

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_unlink_telegram()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can unlink Telegram';
  END IF;

  UPDATE public.profiles
  SET telegram_admin_chat_id = NULL
  WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_telegram_link_status()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'linked', p.telegram_admin_chat_id IS NOT NULL,
    'chat_id', p.telegram_admin_chat_id
  )
  FROM public.profiles p
  WHERE p.id = auth.uid() AND public.bs_is_admin();
$$;

-- Consumed by Telegram webhook via service role only
CREATE OR REPLACE FUNCTION public.admin_consume_telegram_link_code(
  p_code text,
  p_chat_id bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.admin_telegram_link_codes%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.admin_telegram_link_codes
  WHERE code = upper(trim(p_code))
    AND used_at IS NULL
    AND expires_at > now()
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invalid or expired code');
  END IF;

  UPDATE public.admin_telegram_link_codes
  SET used_at = now()
  WHERE code = v_row.code;

  UPDATE public.profiles
  SET telegram_admin_chat_id = NULL
  WHERE telegram_admin_chat_id = p_chat_id AND id <> v_row.admin_user_id;

  UPDATE public.profiles
  SET telegram_admin_chat_id = p_chat_id
  WHERE id = v_row.admin_user_id;

  RETURN jsonb_build_object(
    'ok', true,
    'admin_user_id', v_row.admin_user_id
  );
END;
$$;

-- Resolve admin by linked chat id (service role)
CREATE OR REPLACE FUNCTION public.admin_by_telegram_chat(p_chat_id bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.telegram_admin_chat_id = p_chat_id
    AND public.bs_is_admin(p.id)
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_sessions(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_activity(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_telegram_link_code() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_unlink_telegram() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_telegram_link_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_consume_telegram_link_code(text, bigint) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_by_telegram_chat(bigint) TO service_role;
