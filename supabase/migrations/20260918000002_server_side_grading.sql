-- Test sitting integrity:
-- 1) Attempts are graded and recorded server-side via submit_attempt(); the
--    browser can no longer supply is_correct, insert attempt rows, or probe
--    grade_answer per choice (the enumeration oracle is revoked).
-- 2) complete_session() computes the final score server-side from the recorded
--    attempts; the client can no longer forge completed_at/score/correct_count.
-- 3) Mock sessions must be created through start_mock_session(), which derives
--    the question set from mock_exam_sections/test_questions on the server — a
--    forged 1-question "mock" can no longer project to a perfect 1600.
-- 4) RLS/grants: direct INSERT into attempts is gone; deleting own sessions or
--    attempts is blocked; score columns and the session question set are
--    trigger-guarded with self-validation (no bypassable session flag).

-- ---------------------------------------------------------------------------
-- 1. Score curve, ported from lib/sat (client/server parity)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bs_scale_section(
  p_section text,
  p_correct int,
  p_total int
)
RETURNS int
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  curve double precision[] := CASE p_section
    WHEN 'reading_writing' THEN ARRAY[
      [0,200,0],[5,230,0],[10,290,0],[15,350,0],[20,410,0],[25,470,0],
      [30,530,0],[35,590,0],[40,650,0],[45,710,0],[49,760,0],[52,790,0],[54,800,0]
    ]::double precision[]
    ELSE ARRAY[
      [0,200,0],[4,240,0],[8,300,0],[12,360,0],[16,420,0],[20,480,0],
      [24,540,0],[28,600,0],[32,660,0],[36,710,0],[40,760,0],[42,780,0],[44,800,0]
    ]::double precision[]
  END;
  official double precision := CASE p_section WHEN 'reading_writing' THEN 54 ELSE 44 END;
  projected double precision;
  scaled double precision := NULL;
  v_raw double precision;
  i int;
  x1 double precision; y1 double precision;
  x2 double precision; y2 double precision;
BEGIN
  IF p_total IS NULL OR p_total <= 0 OR p_correct IS NULL THEN
    RETURN NULL;
  END IF;
  projected := (GREATEST(0, LEAST(p_total, p_correct))::double precision / p_total) * official;

  FOR i IN 1..array_length(curve, 1) - 1 LOOP
    x1 := curve[i][1]; y1 := curve[i][2];
    x2 := curve[i + 1][1]; y2 := curve[i + 1][2];
    IF projected >= x1 AND projected <= x2 THEN
      v_raw := y1 + CASE WHEN x2 = x1 THEN 0 ELSE (projected - x1) / (x2 - x1) * (y2 - y1) END;
      scaled := ROUND(v_raw / 10) * 10;
      EXIT;
    END IF;
  END LOOP;

  IF scaled IS NULL THEN
    scaled := curve[array_length(curve, 1)][2];
  END IF;
  RETURN LEAST(800, GREATEST(200, scaled::int));
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. submit_attempt — grade one question inside the caller's active session
-- ---------------------------------------------------------------------------
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

-- grade_answer becomes internal-only: exposed directly it is a per-choice
-- answer oracle (call with A/B/C/D until true). submit_attempt is one-shot per
-- question, so the answer key can no longer be extracted choice by choice.
REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text, uuid) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.grade_answer(uuid, text, text, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. complete_session — server-computed final score
-- ---------------------------------------------------------------------------
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

  -- Per-section totals come from the question set the session actually
  -- contains — never from a client-writable column.
  SELECT
    count(*) FILTER (WHERE q.section = 'reading_writing'),
    count(*) FILTER (WHERE q.section = 'math')
  INTO v_rw_total, v_math_total
  FROM jsonb_array_elements_text(COALESCE(v_sess.metadata->'question_ids', '[]'::jsonb)) AS qid(q)
  LEFT JOIN public.questions q ON q.id = qid(q)::uuid;

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

  -- Whitelist this definer write through the guard trigger (transaction-local).
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

-- ---------------------------------------------------------------------------
-- 4. start_mock_session — server-derived question set for mocks
--
-- Mocks are the only scaled (200-800) scores, so their question set must come
-- from the exam definition, not from client metadata. Derivation mirrors the
-- client's startMockSession: linked tests via mock_exam_sections (ordered
-- R&W-first, then module, then position), falling back to mock_exam_questions.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_mock_session(p_mock_exam_id uuid)
RETURNS uuid
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
  v_modules jsonb;
  v_ids jsonb;
  v_count int;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mock_exams WHERE id = p_mock_exam_id) THEN
    RAISE EXCEPTION 'Mock exam not found';
  END IF;

  -- Linked tests path: mock_exam_sections -> test_questions. `tests` carries
  -- the authoritative section/module; mock_exam_sections only has a name.
  -- Multiple section rows can resolve to the same section:module key, so the
  -- question lists are merged per key (mirrors the client's startMockSession).
  SELECT COALESCE(jsonb_agg(modules), '[]'::jsonb) INTO v_modules
  FROM (
    SELECT
      jsonb_build_object(
        'section', m_key.section,
        'module', m_key.module,
        'question_ids', m_key.qids
      ) AS modules,
      (m_key.section = 'math') AS ord_a,
      m_key.module AS ord_b
    FROM (
      SELECT
        COALESCE(t.section::text, 'reading_writing') AS section,
        COALESCE(t.module, s.module, 1) AS module,
        jsonb_agg(qid ORDER BY qpos) AS qids
      FROM public.mock_exam_sections s
      LEFT JOIN public.tests t ON t.id = s.test_id
      LEFT JOIN LATERAL (
        SELECT tq.question_id AS qid, tq.position AS qpos
        FROM public.test_questions tq
        WHERE tq.test_id = s.test_id
        ORDER BY tq.position
      ) q ON true
      WHERE s.mock_exam_id = p_mock_exam_id AND s.test_id IS NOT NULL
      GROUP BY 1, 2
    ) m_key
    ORDER BY ord_a, ord_b
  ) sub;

  IF v_modules = '[]'::jsonb THEN
    -- Fallback path: flat mock_exam_questions.
    SELECT COALESCE(jsonb_object_agg(key, vals), '[]'::jsonb) INTO v_modules
    FROM (
      SELECT
        (q.section::text || ':' || (COALESCE(q.module, 1))::text) AS key,
        jsonb_build_object(
          'section', q.section::text,
          'module', COALESCE(q.module, 1),
          'question_ids', jsonb_agg(q.question_id ORDER BY q.position)
        ) AS vals
      FROM public.mock_exam_questions q
      WHERE q.mock_exam_id = p_mock_exam_id
      GROUP BY 1
    ) g;
    -- Rebuild as a section-ordered array.
    SELECT COALESCE(jsonb_agg(m ORDER BY (m->>'section') = 'math', (m->>'module')::int), '[]'::jsonb)
      INTO v_modules
    FROM jsonb_array_elements(v_modules) AS m;
  ELSE
    -- Order linked modules R&W first, then by module number.
    SELECT COALESCE(jsonb_agg(m ORDER BY (m->>'section') = 'math', (m->>'module')::int), '[]'::jsonb)
      INTO v_modules
    FROM jsonb_array_elements(v_modules) AS m;
  END IF;

  SELECT COALESCE(jsonb_agg(qid), '[]'::jsonb) INTO v_ids
  FROM jsonb_array_elements(v_modules) AS m,
       LATERAL jsonb_array_elements(m->'question_ids') AS qid;

  v_count := jsonb_array_length(v_ids);
  IF v_count = 0 THEN
    RAISE EXCEPTION 'This mock exam has no questions yet.';
  END IF;

  -- Resume: an unfinished mock for this exam+user keeps its question set.
  SELECT id INTO v_id
  FROM public.test_sessions
  WHERE user_id = v_uid
    AND mock_exam_id = p_mock_exam_id
    AND completed_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- Whitelist this definer write through the guard trigger (transaction-local).
  PERFORM set_config('beyondsat.server_write', 'on', true);

  INSERT INTO public.test_sessions (
    user_id, type, mock_exam_id, total_questions, metadata
  )
  VALUES (
    v_uid, 'mock', p_mock_exam_id, v_count,
    jsonb_build_object('question_ids', v_ids, 'modules', v_modules)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.start_mock_session(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_mock_session(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- 5. RLS / grant tightening + guards
-- ---------------------------------------------------------------------------
-- Attempts: no direct INSERT/UPDATE/DELETE (rows come only from submit_attempt).
REVOKE INSERT, UPDATE, DELETE ON public.attempts FROM authenticated;
GRANT SELECT ON public.attempts TO authenticated;

DROP POLICY IF EXISTS "Users insert own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users update own attempts" ON public.attempts;
DROP POLICY IF EXISTS "Users delete own attempts" ON public.attempts;

-- Test sessions: DELETE gone (history is part of analytics).
REVOKE DELETE ON public.test_sessions FROM authenticated;
DROP POLICY IF EXISTS "Users delete own sessions" ON public.test_sessions;

CREATE OR REPLACE FUNCTION public.bs_test_sessions_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected int;
  v_rw_correct int;
  v_rw_total int;
  v_math_correct int;
  v_math_total int;
BEGIN
  -- PostgREST cannot set custom GUCs; the server-side RPCs raise this flag
  -- (transaction-local) before their writes. Same pattern as
  -- bs_lock_profile_security_columns' 'beyondsat.clear_must_change'.
  IF current_setting('beyondsat.server_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  IF public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Mocks must be created by start_mock_session (server-derived set).
    IF NEW.type = 'mock' THEN
      RAISE EXCEPTION 'Mock sessions are created server-side';
    END IF;

    -- total_questions must equal the declared question set.
    v_expected := COALESCE(jsonb_array_length(NEW.metadata->'question_ids'), 0);
    IF COALESCE(NEW.total_questions, 0) <> v_expected THEN
      RAISE EXCEPTION 'total_questions must match the session question set';
    END IF;

    -- A brand-new session starts unfinished and unscored.
    IF NEW.completed_at IS NOT NULL OR NEW.score IS NOT NULL
       OR NEW.rw_score IS NOT NULL OR NEW.math_score IS NOT NULL
       OR NEW.correct_count IS NOT NULL THEN
      RAISE EXCEPTION 'Session results are computed server-side';
    END IF;
    RETURN NEW;
  END IF;

  -- Question set cannot be swapped mid-session.
  IF NEW.metadata->'question_ids' IS DISTINCT FROM OLD.metadata->'question_ids' THEN
    RAISE EXCEPTION 'Session question set cannot be changed';
  END IF;

  IF NEW.completed_at IS NULL THEN
    -- Still in progress: no score column may move.
    IF NEW.score IS DISTINCT FROM OLD.score
       OR NEW.rw_score IS DISTINCT FROM OLD.rw_score
       OR NEW.math_score IS DISTINCT FROM OLD.math_score
       OR NEW.correct_count IS DISTINCT FROM OLD.correct_count
       OR NEW.total_questions IS DISTINCT FROM OLD.total_questions THEN
      RAISE EXCEPTION 'Session results are computed server-side';
    END IF;
    RETURN NEW;
  END IF;

  -- Completing: only accept values that match what the attempts table
  -- actually supports. Self-validating — a forged score fails this check, and
  -- the legitimate client values equal the derived ones anyway.
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

DROP TRIGGER IF EXISTS bs_test_sessions_guard ON public.test_sessions;
CREATE TRIGGER bs_test_sessions_guard
  BEFORE INSERT OR UPDATE ON public.test_sessions
  FOR EACH ROW EXECUTE FUNCTION public.bs_test_sessions_guard();
