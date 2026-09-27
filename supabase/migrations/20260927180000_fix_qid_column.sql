-- Postgres parsed qid(q) as a function call. The column from AS qid(q) is qid.q.

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

CREATE OR REPLACE FUNCTION public.complete_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_sess public.test_sessions%ROWTYPE;
  v_correct int;
  v_total int;
  v_rw_total int;
  v_rw_correct int;
  v_math_total int;
  v_math_correct int;
  v_rw_scaled int;
  v_math_scaled int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_sess FROM public.test_sessions
  WHERE id = p_session_id AND user_id = v_uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_sess.completed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'alreadyCompleted', true,
      'correct', v_sess.correct_count,
      'total', v_sess.total_questions,
      'rw', v_sess.rw_score,
      'math', v_sess.math_score,
      'totalScore', v_sess.score
    );
  END IF;

  SELECT
    count(*) FILTER (WHERE q.section = 'reading_writing'),
    count(*) FILTER (WHERE q.section = 'math')
  INTO v_rw_total, v_math_total
  FROM jsonb_array_elements_text(COALESCE(v_sess.metadata->'question_ids', '[]'::jsonb)) AS qid(q)
  LEFT JOIN public.questions q ON q.id = qid.q::uuid;

  v_total := COALESCE(v_rw_total, 0) + COALESCE(v_math_total, 0);

  SELECT
    count(*) FILTER (WHERE a.is_correct)::int
  INTO v_rw_correct
  FROM public.attempts a
  JOIN public.questions q ON q.id = a.question_id
  WHERE a.session_id = p_session_id AND q.section = 'reading_writing';

  SELECT
    count(*) FILTER (WHERE a.is_correct)::int
  INTO v_math_correct
  FROM public.attempts a
  JOIN public.questions q ON q.id = a.question_id
  WHERE a.session_id = p_session_id AND q.section = 'math';

  v_rw_correct := COALESCE(v_rw_correct, 0);
  v_math_correct := COALESCE(v_math_correct, 0);
  v_correct := v_rw_correct + v_math_correct;

  v_rw_scaled := CASE WHEN v_rw_total > 0 THEN public.bs_scale_section('reading_writing', v_rw_correct, v_rw_total) END;
  v_math_scaled := CASE WHEN v_math_total > 0 THEN public.bs_scale_section('math', v_math_correct, v_math_total) END;

  PERFORM set_config('beyondsat.server_write', 'on', true);

  UPDATE public.test_sessions
  SET completed_at = now(),
      correct_count = v_correct,
      total_questions = v_total,
      rw_score = CASE WHEN v_sess.type = 'mock' THEN v_rw_scaled ELSE NULL END,
      math_score = CASE WHEN v_sess.type = 'mock' THEN v_math_scaled ELSE NULL END,
      score = CASE
        WHEN v_sess.type = 'mock' THEN COALESCE(v_rw_scaled, 0) + COALESCE(v_math_scaled, 0)
        ELSE v_correct
      END,
      metadata = v_sess.metadata - 'draft_answers'
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'alreadyCompleted', false,
    'correct', v_correct,
    'total', v_total,
    'rwCorrect', v_rw_correct,
    'rwTotal', v_rw_total,
    'mathCorrect', v_math_correct,
    'mathTotal', v_math_total,
    'rw', v_rw_scaled,
    'math', v_math_scaled,
    'totalScore', CASE
      WHEN v_sess.type = 'mock' THEN COALESCE(v_rw_scaled, 0) + COALESCE(v_math_scaled, 0)
      ELSE v_correct
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_session(uuid) TO authenticated;
