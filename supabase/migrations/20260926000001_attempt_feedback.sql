-- Mid-practice rationale: only after a stored incorrect attempt.
-- Correct attempts and ungraded questions return no rows (no answer oracle).

CREATE OR REPLACE FUNCTION public.get_attempt_feedback(
  p_session_id uuid,
  p_question_id uuid
)
RETURNS TABLE(
  correct_choice_id text,
  correct_grid_answers text[],
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.attempts a
      JOIN public.test_sessions s ON s.id = a.session_id
     WHERE a.session_id = p_session_id
       AND a.question_id = p_question_id
       AND a.user_id = auth.uid()
       AND s.user_id = auth.uid()
       AND a.is_correct = false
       AND s.type IN ('practice', 'daily')
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT q.correct_choice_id, q.correct_grid_answers, q.explanation
      FROM public.questions q
     WHERE q.id = p_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attempt_feedback(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attempt_feedback(uuid, uuid) TO authenticated;
