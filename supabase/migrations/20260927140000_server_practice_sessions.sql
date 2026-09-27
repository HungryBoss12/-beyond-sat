-- Practice and daily sessions must be created server-side.
-- Client inserts could put arbitrary question ids (including mock items) into
-- metadata.question_ids, then get_attempt_feedback would return the answer key.

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

-- Filtered practice. The server picks the ids; the client cannot supply them.
CREATE OR REPLACE FUNCTION public.start_filtered_practice(
  p_section text,
  p_skill text DEFAULT NULL,
  p_difficulty text DEFAULT NULL,
  p_limit integer DEFAULT 20
)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_limit int;
  v_ids jsonb;
  v_count int;
  v_id uuid;
  v_skills text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_section NOT IN ('reading_writing', 'math') THEN
    RAISE EXCEPTION 'Unknown section';
  END IF;

  v_limit := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 50);
  IF p_section = 'reading_writing' THEN
    v_skills := ARRAY[
      'craft and structure',
      'information and ideas',
      'standard english conventions',
      'expression of ideas'
    ];
  ELSE
    v_skills := ARRAY[
      'algebra',
      'advanced math',
      'problem-solving and data analysis',
      'geometry and trigonometry'
    ];
  END IF;

  SELECT COALESCE(jsonb_agg(id ORDER BY created_at DESC), '[]'::jsonb) INTO v_ids
  FROM (
    SELECT q.id::text AS id, q.created_at
    FROM public.questions q
    WHERE q.section::text = p_section
      AND q.published IS TRUE
      AND (p_skill IS NULL OR btrim(p_skill) = '' OR q.skill = p_skill)
      AND (
        p_difficulty IS NULL OR btrim(p_difficulty) = ''
        OR q.difficulty::text = p_difficulty
      )
      AND btrim(COALESCE(q.question_text, '')) <> ''
      AND lower(btrim(q.question_text)) NOT LIKE 'missing question%'
      AND lower(btrim(q.question_text)) NOT LIKE '[missing%'
      AND lower(btrim(q.question_text)) <> 'missing'
      AND lower(btrim(COALESCE(q.skill, ''))) = ANY (v_skills)
    ORDER BY q.created_at DESC
    LIMIT v_limit
  ) picked;

  v_count := jsonb_array_length(v_ids);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No questions match this filter yet.';
  END IF;

  PERFORM set_config('beyondsat.server_write', 'on', true);
  INSERT INTO public.test_sessions (user_id, type, total_questions, metadata)
  VALUES (
    v_uid,
    'practice',
    v_count,
    jsonb_build_object(
      'question_ids', v_ids,
      'section', p_section,
      'skill', NULLIF(btrim(COALESCE(p_skill, '')), ''),
      'difficulty', NULLIF(btrim(COALESCE(p_difficulty, '')), '')
    )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_filtered_practice(text, text, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_filtered_practice(text, text, text, integer) TO authenticated;

-- Published test pack. Question ids come from test_questions, not the client.
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
    SELECT 1 FROM public.tests t WHERE t.id = p_test_id AND t.published IS TRUE
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

-- Today's daily test. Question ids come from the daily definition.
CREATE OR REPLACE FUNCTION public.start_daily_session(p_date date DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_daily uuid;
  v_id uuid;
  v_ids jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_date IS NULL THEN
    p_date := (now() AT TIME ZONE 'utc')::date;
  END IF;
  IF p_date < (now() AT TIME ZONE 'utc')::date - 1
     OR p_date > (now() AT TIME ZONE 'utc')::date + 1 THEN
    RAISE EXCEPTION 'No daily test is available for today.';
  END IF;

  SELECT id INTO v_daily
  FROM public.daily_tests
  WHERE date = p_date;
  IF v_daily IS NULL THEN
    RAISE EXCEPTION 'No daily test is available for today.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.test_sessions
    WHERE user_id = v_uid AND daily_test_id = v_daily AND completed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'You already finished today''s daily test.';
  END IF;

  SELECT id INTO v_id
  FROM public.test_sessions
  WHERE user_id = v_uid AND daily_test_id = v_daily AND completed_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN jsonb_build_object('id', v_id, 'resumed', true);
  END IF;

  SELECT COALESCE(jsonb_agg(qid ORDER BY dpos, qpos), '[]'::jsonb) INTO v_ids
  FROM (
    SELECT tq.question_id::text AS qid, dtt.position AS dpos, tq.position AS qpos
    FROM public.daily_test_tests dtt
    JOIN public.test_questions tq ON tq.test_id = dtt.test_id
    WHERE dtt.daily_test_id = v_daily
  ) linked;
  v_count := jsonb_array_length(v_ids);

  IF v_count = 0 THEN
    SELECT COALESCE(jsonb_agg(qid ORDER BY pos), '[]'::jsonb) INTO v_ids
    FROM (
      SELECT dq.question_id::text AS qid, dq.position AS pos
      FROM public.daily_test_questions dq
      WHERE dq.daily_test_id = v_daily
    ) flat;
    v_count := jsonb_array_length(v_ids);
  END IF;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Today''s daily test has no questions yet.';
  END IF;

  PERFORM set_config('beyondsat.server_write', 'on', true);
  INSERT INTO public.test_sessions (
    user_id, type, daily_test_id, total_questions, metadata
  )
  VALUES (
    v_uid, 'daily', v_daily, v_count,
    jsonb_build_object('question_ids', v_ids)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'resumed', false);
END;
$$;

REVOKE ALL ON FUNCTION public.start_daily_session(date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_daily_session(date) TO authenticated;

-- Rationale only after a stored wrong attempt, and only for a question the
-- server put on that practice or daily session.
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
