-- One student row lists every class, instead of one membership winning.

DROP FUNCTION IF EXISTS public.staff_list_students(text);

CREATE FUNCTION public.staff_list_students(p_search text DEFAULT '')
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
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.full_name,
    s.phone,
    s.parent_phone,
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
     OR COALESCE(s.phone, '') ILIKE '%' || v_search || '%'
     OR COALESCE(p.username, '') ILIKE v_search || '%'
  ORDER BY s.full_name
  LIMIT 400;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_students(text) TO authenticated;

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
  staff_created boolean
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
    coalesce(p.staff_created, false)
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
  ORDER BY p.created_at DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated;

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
    'class_name', coalesce(
      (
        SELECT string_agg(cls.name, ', ' ORDER BY cls.name)
        FROM public.class_memberships m
        JOIN public.classes cls ON cls.id = m.class_id
        WHERE m.user_id = p.id
      ),
      c.name
    ),
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

GRANT EXECUTE ON FUNCTION public.admin_user_detail(uuid) TO authenticated;
