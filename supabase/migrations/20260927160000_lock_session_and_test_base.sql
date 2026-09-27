-- Lock session identity so a mock cannot be relabeled as practice to read
-- get_attempt_feedback. Hide Test Base packs from students.

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

  IF NEW.type IS DISTINCT FROM OLD.type
     OR NEW.mock_exam_id IS DISTINCT FROM OLD.mock_exam_id
     OR NEW.daily_test_id IS DISTINCT FROM OLD.daily_test_id THEN
    RAISE EXCEPTION 'Session identity cannot be changed';
  END IF;

  IF NEW.metadata->'question_ids' IS DISTINCT FROM OLD.metadata->'question_ids' THEN
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
  LEFT JOIN public.questions q ON q.id = qid(q)::uuid
  LEFT JOIN public.attempts a
    ON a.question_id = qid(q)::uuid AND a.session_id = OLD.id;

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
       AND s.mock_exam_id IS NULL
       AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text)
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

CREATE OR REPLACE FUNCTION public.start_published_test_session(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_ids jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.tests t
    WHERE t.id = p_test_id
      AND t.published IS TRUE
      AND t.in_test_base IS NOT TRUE
  ) THEN
    RAISE EXCEPTION 'That practice set isn''t available.';
  END IF;

  SELECT id INTO v_id
  FROM public.test_sessions
  WHERE user_id = v_uid
    AND type = 'practice'
    AND completed_at IS NULL
    AND metadata->>'test_id' = p_test_id::text
  ORDER BY started_at DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'resumed', true);
  END IF;

  SELECT COALESCE(jsonb_agg(qid ORDER BY pos), '[]'::jsonb) INTO v_ids
  FROM (
    SELECT tq.question_id::text AS qid, tq.position AS pos
    FROM public.test_questions tq
    WHERE tq.test_id = p_test_id
  ) ordered;

  v_count := jsonb_array_length(v_ids);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'This test set has no questions yet.';
  END IF;

  PERFORM set_config('beyondsat.server_write', 'on', true);
  INSERT INTO public.test_sessions (user_id, type, total_questions, metadata)
  VALUES (
    v_uid,
    'practice',
    v_count,
    jsonb_build_object('question_ids', v_ids, 'test_id', p_test_id)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'resumed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.start_published_test_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_published_test_session(uuid) TO authenticated;

DROP POLICY IF EXISTS "tests read auth" ON public.tests;
CREATE POLICY "tests read auth" ON public.tests
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR (published IS TRUE AND in_test_base IS NOT TRUE)
  );
