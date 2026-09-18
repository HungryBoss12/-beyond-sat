-- Vocab quiz answer-key protection:
-- 1) Students can read quiz questions (passage/options) but NOT the answer key
--    (correct_answer/explanation) — enforced with column-level grants. The old
--    policy exposed `SELECT *` with the correct answer to every signed-in user.
-- 2) Grading moves into submit_vocab_quiz(), a SECURITY DEFINER RPC that
--    computes the score server-side, records the attempt, enforces that every
--    graded question belongs to the quiz, and reveals the key only as part of a
--    recorded submission (with a duplicate-submit guard).

-- ---------------------------------------------------------------------------
-- 1. Column-level grants: hide correct_answer/explanation from reads
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.vocab_quiz_questions FROM anon;
REVOKE ALL ON public.vocab_quiz_questions FROM authenticated;

GRANT SELECT (
  id, quiz_id, vocab_card_id, passage_text, options, position
) ON public.vocab_quiz_questions TO authenticated;

-- Staff write path (admin-save) keeps INSERT/UPDATE of the key via the
-- bs_is_staff() RLS policies; PostgREST writes must name only granted columns.
GRANT INSERT (
  quiz_id, vocab_card_id, passage_text, correct_answer, options, explanation, position
) ON public.vocab_quiz_questions TO authenticated;
GRANT UPDATE (
  passage_text, correct_answer, options, explanation, position
) ON public.vocab_quiz_questions TO authenticated;
GRANT DELETE ON public.vocab_quiz_questions TO authenticated;
GRANT ALL ON public.vocab_quiz_questions TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Server-side grading + recorded submission
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_vocab_quiz(
  p_quiz_id uuid,
  p_question_ids uuid[],
  p_selected text[]
)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
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
  v_correct boolean;
  v_i int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Duplicate-submit guard: one attempt per 10 seconds, max 25 per day/quiz.
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

  FOR v_i IN 1..coalesce(array_length(p_question_ids, 1), 0) LOOP
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

  RETURN jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percent', round(100.0 * v_score / v_total)::int,
    'missed_card_ids', to_jsonb(v_missed),
    'results', v_results
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_vocab_quiz(uuid, uuid[], text[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_vocab_quiz(uuid, uuid[], text[]) TO authenticated;
