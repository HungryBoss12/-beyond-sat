-- submit_attempt replay guard (pentest finding HIGH-1).
--
-- The previous body graded the incoming choice BEFORE the
-- ON CONFLICT (session_id, question_id) DO NOTHING insert and returned the
-- fresh grade on every call. A replay with a different p_choice_id therefore
-- re-graded without recording — a per-choice answer oracle (call A/B/C/D
-- until true, harvest the key, retake the mock for a perfect score).
-- Live-confirmed PoC: submit B -> false; replay A -> true (row stayed B/false).
--
-- Fix: if an attempt row already exists for (session, question), return its
-- STORED is_correct and never call grade_answer again. A per-call advisory
-- lock closes the concurrent-replay race (two in-flight submits for the same
-- question serialize; the loser sees the winner's row on re-check).

CREATE OR REPLACE FUNCTION public.submit_attempt(
  p_session_id uuid,
  p_question_id uuid,
  p_choice_id text,
  p_grid_answer text,
  p_marked_for_review boolean DEFAULT false,
  p_eliminated text[] DEFAULT NULL,
  p_time_spent integer DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_correct boolean;
  v_stored boolean;
  v_kind public.question_kind;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- The question must belong to the caller's own unfinished session.
  IF NOT EXISTS (
    SELECT 1 FROM public.test_sessions s
    WHERE s.id = p_session_id
      AND s.user_id = v_uid
      AND s.completed_at IS NULL
      AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text)
  ) THEN
    RAISE EXCEPTION 'Question is not in an active session';
  END IF;

  -- Serialize concurrent submits for the same (session, question), then
  -- return the STORED result on replay: re-grading a different choice would
  -- leak the answer key one choice at a time.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(p_session_id::text || ':' || p_question_id::text, 0)
  );

  SELECT a.is_correct INTO v_stored
  FROM public.attempts a
  WHERE a.session_id = p_session_id AND a.question_id = p_question_id;
  IF v_stored IS NOT NULL THEN
    RETURN v_stored;
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

  -- Idempotent per (session, question) via attempts_session_question_key.
  INSERT INTO public.attempts (
    user_id, session_id, question_id, test_type, selected_choice_id,
    grid_answer, is_correct, marked_for_review, eliminated_choice_ids,
    time_spent_seconds
  )
  SELECT
    v_uid, p_session_id, p_question_id, s.type, p_choice_id,
    NULLIF(p_grid_answer, ''), v_correct, COALESCE(p_marked_for_review, false),
    COALESCE(p_eliminated, ARRAY[]::text[]), p_time_spent
  FROM public.test_sessions s
  WHERE s.id = p_session_id
  ON CONFLICT (session_id, question_id) DO NOTHING;

  RETURN v_correct;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_attempt(uuid, uuid, text, text, boolean, text[], integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_attempt(uuid, uuid, text, text, boolean, text[], integer) TO authenticated;
