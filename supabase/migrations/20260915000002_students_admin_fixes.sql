-- Students admin fixes: service_role grants, membership RPC, class_name from memberships.

-- ---------------------------------------------------------------------
-- Grants (classes migration only granted authenticated)
-- ---------------------------------------------------------------------
GRANT ALL ON public.classes TO service_role;
GRANT ALL ON public.class_memberships TO service_role;
GRANT ALL ON public.chat_threads TO service_role;
GRANT ALL ON public.chat_thread_members TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.chat_message_attachments TO service_role;
GRANT ALL ON public.homework_assignments TO service_role;
GRANT ALL ON public.homework_files TO service_role;
GRANT ALL ON public.homework_submissions TO service_role;
GRANT ALL ON public.homework_submission_files TO service_role;
GRANT ALL ON public.lesson_attendance TO service_role;

-- ---------------------------------------------------------------------
-- Staff: move/add a user to a class atomically (membership + profile sync via trigger)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_set_class_member(p_class_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class_id) THEN
    RAISE EXCEPTION 'That class group was not found.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  DELETE FROM public.class_memberships WHERE user_id = p_user_id;
  INSERT INTO public.class_memberships (class_id, user_id)
  VALUES (p_class_id, p_user_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_set_class_member(uuid, uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- admin_users_summary: username + class_name from class_memberships
-- ---------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.admin_users_summary();

CREATE OR REPLACE FUNCTION public.admin_users_summary()
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
    coalesce(cm_class.name, c.name),
    CASE
      WHEN coalesce(att.att_total, 0) = 0 THEN NULL
      ELSE round(100.0 * att.att_correct / att.att_total)::integer
    END
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN public.class_memberships cm ON cm.user_id = p.id
  LEFT JOIN public.classes cm_class ON cm_class.id = cm.class_id
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

-- ---------------------------------------------------------------------
-- admin_user_detail: class_name from membership first
-- ---------------------------------------------------------------------
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
    'class_name', coalesce(cm_class.name, c.name),
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
  LEFT JOIN public.class_memberships cm ON cm.user_id = p.id
  LEFT JOIN public.classes cm_class ON cm_class.id = cm.class_id
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
