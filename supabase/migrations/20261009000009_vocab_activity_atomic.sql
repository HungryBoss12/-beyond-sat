-- Vocab activity was a read-then-write from the Worker on the UTC day. Parallel
-- ratings lost counts, the first review of the day could hit the unique key,
-- and the day rolled over at 05:00 in Tashkent. Both writes below are single
-- statements on the Tashkent day.

CREATE OR REPLACE FUNCTION public.bs_record_vocab_activity(p_cards integer DEFAULT 1)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_today date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_first boolean;
  v_last date;
  v_streak integer;
  v_longest integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vocab_activity_logs (user_id, activity_date, cards_reviewed, completed_at)
  VALUES (v_uid, v_today, greatest(coalesce(p_cards, 1), 0), now())
  ON CONFLICT (user_id, activity_date) DO UPDATE
    SET cards_reviewed = public.vocab_activity_logs.cards_reviewed + excluded.cards_reviewed,
        completed_at = excluded.completed_at
  RETURNING (xmax = 0) INTO v_first;

  SELECT (last_active_at AT TIME ZONE 'Asia/Tashkent')::date, current_streak, longest_streak
    INTO v_last, v_streak, v_longest
  FROM public.student_profiles
  WHERE user_id = v_uid
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('first_today', v_first);
  END IF;

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
    WHERE user_id = v_uid;
  ELSE
    UPDATE public.student_profiles SET last_active_at = now() WHERE user_id = v_uid;
  END IF;

  RETURN jsonb_build_object('first_today', v_first, 'streak', v_streak);
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_bump_vocab_homework(
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
  v_uid uuid := auth.uid();
  v_target integer;
  v_green_only boolean;
  v_row public.vocab_homework_completions;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501';
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
      OR (a.audience_type = 'class' AND public.bs_is_class_member(a.class_id, v_uid))
      OR (a.audience_type = 'users' AND public.bs_is_vocab_homework_assigned(a.id, v_uid))
    );
  IF NOT FOUND THEN
    RAISE EXCEPTION 'not assigned' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vocab_homework_completions
    (assignment_id, user_id, period_key, cards_reviewed, green_reviews, status)
  VALUES (p_assignment_id, v_uid, p_period_key, 1, CASE WHEN p_green THEN 1 ELSE 0 END, 'in_progress')
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

REVOKE ALL ON FUNCTION public.bs_record_vocab_activity(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bs_bump_vocab_homework(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_record_vocab_activity(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bs_bump_vocab_homework(uuid, text, boolean) TO authenticated, service_role;
