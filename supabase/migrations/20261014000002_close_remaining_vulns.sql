-- 1. Enforce ban checks inside student-callable SECURITY DEFINER RPCs
-- 2. Lock vocab_homework_completions from direct client writes; complete quiz homework inside submit_vocab_quiz
-- 3. Prevent non-staff from overwriting shared lesson_video_catalog titles/URLs
-- 4. Restrict open_direct_thread to peers visible in chat_directory and remove direct-thread self-insert
-- 5. Scope question-images and lesson-uploads storage reads to published rows or staff
-- 6. Clamp bs_record_vocab_activity p_cards and lock bs_is_class_member / bs_is_thread_member against cross-user probing

-- ---------------------------------------------------------------------------
-- 6. Helper oracle locks & bounds
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bs_is_class_member(
  _class_id uuid,
  _uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COALESCE(_uid = auth.uid(), false) OR public.bs_is_staff(auth.uid()))
    AND NOT public.bs_is_self_banned()
    AND EXISTS (
      SELECT 1 FROM public.class_memberships m
      WHERE m.class_id = _class_id AND m.user_id = _uid
    );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_thread_member(
  _thread_id uuid,
  _uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT (COALESCE(_uid = auth.uid(), false) OR public.bs_is_staff(auth.uid()))
    AND NOT public.bs_is_self_banned()
    AND (
      EXISTS (
        SELECT 1 FROM public.chat_thread_members m
        WHERE m.thread_id = _thread_id AND m.user_id = _uid
      )
      OR public.bs_is_staff(_uid)
    );
$$;

-- ---------------------------------------------------------------------------
-- 1. Student-callable SECURITY DEFINER RPCs: ban guards + fixes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_presence()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR public.bs_is_self_banned() THEN
    RETURN;
  END IF;
  UPDATE public.profiles SET last_seen_at = now() WHERE id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_answers_for_review(p_question_ids uuid[])
RETURNS TABLE(question_id uuid, correct_choice_id text, correct_grid_answers text[], explanation text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.correct_choice_id, q.correct_grid_answers, q.explanation
    FROM public.questions q
   WHERE NOT public.bs_is_self_banned()
     AND q.id = ANY(p_question_ids)
     AND EXISTS (
       SELECT 1
         FROM public.attempts a
         JOIN public.test_sessions s ON s.id = a.session_id
        WHERE a.question_id = q.id
          AND a.user_id = auth.uid()
          AND s.user_id = auth.uid()
          AND s.completed_at IS NOT NULL
     );
$$;

CREATE OR REPLACE FUNCTION public.get_attempt_feedback(p_session_id uuid, p_question_id uuid)
RETURNS TABLE(correct_choice_id text, correct_grid_answers text[], explanation text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.attempts a
      JOIN public.test_sessions s ON s.id = a.session_id
     WHERE a.session_id = p_session_id
       AND a.question_id = p_question_id
       AND a.user_id = auth.uid()
       AND s.user_id = auth.uid()
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

CREATE OR REPLACE FUNCTION public.submit_attempt(
  p_session_id uuid,
  p_question_id uuid,
  p_choice_id text,
  p_grid_answer text,
  p_marked_for_review boolean DEFAULT false,
  p_eliminated text[] DEFAULT NULL::text[],
  p_time_spent integer DEFAULT NULL::integer
)
RETURNS boolean
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.test_sessions s
    WHERE s.id = p_session_id
      AND s.user_id = v_uid
      AND s.completed_at IS NULL
      AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text)
  ) THEN
    RAISE EXCEPTION 'Question is not in an active session';
  END IF;

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

CREATE OR REPLACE FUNCTION public.complete_session(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.start_daily_session(p_date date DEFAULT NULL::date)
RETURNS jsonb
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.start_filtered_practice(
  p_section text,
  p_skill text DEFAULT NULL::text,
  p_difficulty text DEFAULT NULL::text,
  p_limit integer DEFAULT 20
)
RETURNS uuid
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.start_mock_session(p_mock_exam_id uuid)
RETURNS uuid
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.mock_exams WHERE id = p_mock_exam_id) THEN
    RAISE EXCEPTION 'Mock exam not found';
  END IF;

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
    SELECT COALESCE(jsonb_agg(m ORDER BY (m->>'section') = 'math', (m->>'module')::int), '[]'::jsonb)
      INTO v_modules
    FROM jsonb_array_elements(v_modules) AS m;
  ELSE
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

CREATE OR REPLACE FUNCTION public.start_published_test_session(p_test_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.student_billing_home()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'balance', public.bs_student_balance(v_uid),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'kind', r.kind,
        'amount_uzs', r.amount_uzs::text,
        'note', r.note,
        'occurred_on', r.occurred_on
      ) ORDER BY r.occurred_on DESC, r.created_at DESC)
      FROM (
        SELECT e.id, e.kind, e.amount_uzs, e.note, e.occurred_on, e.created_at
        FROM public.ledger_entries e
        WHERE e.user_id = v_uid AND e.voided_at IS NULL
        ORDER BY e.occurred_on DESC, e.created_at DESC
        LIMIT 8
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_complete_intro(
  p_exam_date date,
  p_target_rw integer,
  p_target_math integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF p_exam_date IS NULL THEN
    RAISE EXCEPTION 'Please pick your exam date.';
  END IF;
  IF p_exam_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Your exam date can''t be in the past.';
  END IF;
  IF p_exam_date > (CURRENT_DATE + INTERVAL '3 years')::date THEN
    RAISE EXCEPTION 'Please pick a date within the next three years.';
  END IF;
  IF p_target_rw IS NULL OR p_target_rw < 200 OR p_target_rw > 800 THEN
    RAISE EXCEPTION 'Reading & Writing target must be between 200 and 800.';
  END IF;
  IF p_target_math IS NULL OR p_target_math < 200 OR p_target_math > 800 THEN
    RAISE EXCEPTION 'Math target must be between 200 and 800.';
  END IF;

  INSERT INTO public.student_profiles (
    user_id,
    exam_date,
    target_rw,
    target_math,
    target_score,
    step,
    intro_completed_at
  )
  VALUES (
    uid,
    p_exam_date,
    p_target_rw,
    p_target_math,
    p_target_rw + p_target_math,
    1,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    exam_date = EXCLUDED.exam_date,
    target_rw = EXCLUDED.target_rw,
    target_math = EXCLUDED.target_math,
    target_score = EXCLUDED.target_score,
    step = GREATEST(public.student_profiles.step, 1),
    intro_completed_at = COALESCE(public.student_profiles.intro_completed_at, now());

  PERFORM set_config('beyondsat.complete_intro', 'on', true);

  UPDATE public.profiles
  SET intro_completed = true
  WHERE id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, intro_completed)
    VALUES (uid, true);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.vocab_user_test_quota()
RETURNS TABLE(cap integer, used integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer := 5;
  v_raw text;
  v_day timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  SELECT value INTO v_raw FROM public.app_settings WHERE key = 'vocab_user_test_daily_cap';
  IF v_raw ~ '^[0-9]+$' THEN
    v_cap := v_raw::integer;
  END IF;
  v_day := date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent';
  RETURN QUERY
  SELECT v_cap, count(*)::integer
  FROM public.vocab_quizzes
  WHERE owner_id = auth.uid()
    AND created_at >= v_day;
END;
$$;

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
  v_cards integer := LEAST(GREATEST(COALESCE(p_cards, 1), 0), 50);
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.vocab_activity_logs (user_id, activity_date, cards_reviewed, completed_at)
  VALUES (v_uid, v_today, v_cards, now())
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
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
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

CREATE OR REPLACE FUNCTION public.student_book_support_window(
  p_window_id uuid,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.support_windows%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_uid AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can book support';
  END IF;
  SELECT * INTO v_row FROM public.support_windows WHERE id = p_window_id FOR UPDATE;
  IF v_row.id IS NULL THEN
    RAISE EXCEPTION 'Window not found';
  END IF;
  IF v_row.student_id IS NOT NULL OR v_row.closed OR v_row.starts_at <= now()
     OR v_row.starts_at > now() + interval '24 hours' THEN
    RAISE EXCEPTION 'That window is not open for students yet';
  END IF;
  UPDATE public.support_windows
  SET student_id = v_uid
  WHERE id = p_window_id;
  PERFORM public._support_session_for_window(p_window_id, v_uid, p_subject);
  PERFORM public._support_notify(
    v_row.teacher_id,
    'Support session booked',
    'A student took one of your open sessions.',
    '/admin/support'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.student_cancel_support(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_status text;
  v_owner uuid;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  SELECT student_id, status INTO v_owner, v_status
  FROM public.support_sessions
  WHERE id = p_session_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_owner <> v_student THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending request can be cancelled';
  END IF;
  UPDATE public.support_sessions
  SET status = 'rejected',
      rejection_reason = 'Cancelled by student'
  WHERE id = p_session_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_request_support(
  p_subject public.class_subject,
  p_notes text,
  p_day date,
  p_start timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_id uuid;
  v_name text;
  v_subject text;
  v_teachers uuid[];
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  IF p_day IS NULL OR p_day < (now() AT TIME ZONE 'Asia/Tashkent')::date THEN
    RAISE EXCEPTION 'Pick today or a later date';
  END IF;
  IF p_start IS NULL THEN
    RAISE EXCEPTION 'Pick a time during center hours';
  END IF;
  IF (p_start AT TIME ZONE 'Asia/Tashkent')::date IS DISTINCT FROM p_day THEN
    RAISE EXCEPTION 'That time is not on the chosen day';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.user_id = v_student AND m.status <> 'left'
  ) THEN
    RAISE EXCEPTION 'Only a current student can request support';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.support_sessions s
    WHERE s.student_id = v_student AND s.status = 'pending'
  ) THEN
    RAISE EXCEPTION 'You already have a pending request';
  END IF;
  PERFORM public._support_check_lesson_time(p_start, v_student, NULL);

  INSERT INTO public.support_sessions (
    student_id, teacher_id, slot_id, subject, starts_at, ends_at, notes, preferred_on, expires_at
  )
  VALUES (
    v_student, NULL, NULL, p_subject, p_start, p_start + interval '1 hour',
    NULLIF(btrim(COALESCE(p_notes, '')), ''),
    p_day,
    now() + interval '2 days'
  )
  RETURNING id INTO v_id;

  SELECT COALESCE(full_name, username, 'A student') INTO v_name
  FROM public.profiles WHERE id = v_student;
  v_subject := CASE WHEN p_subject = 'math' THEN 'Math' ELSE 'English' END;
  SELECT COALESCE(array_agg(DISTINCT ur.user_id), ARRAY[]::uuid[]) INTO v_teachers
  FROM public.user_roles ur
  WHERE ur.role = 'teacher';
  PERFORM public._support_notify_users(
    v_teachers,
    'New support request',
    v_name || ' asked for ' || v_subject || ' on '
      || to_char(p_start AT TIME ZONE 'Asia/Tashkent', 'DD Mon HH24:MI') || '.',
    '/admin/support'
  );
  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Lock vocab_homework_completions + record quiz homework in submit_vocab_quiz
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "vocab_homework_completions own write" ON public.vocab_homework_completions;
DROP POLICY IF EXISTS "vocab_homework_completions staff write" ON public.vocab_homework_completions;
CREATE POLICY "vocab_homework_completions staff write"
  ON public.vocab_homework_completions
  FOR ALL
  TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE OR REPLACE FUNCTION public.submit_vocab_quiz(
  p_quiz_id uuid,
  p_question_ids uuid[],
  p_selected text[]
)
RETURNS jsonb
LANGUAGE plpgsql
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
  v_hw record;
  v_period text;
  v_tashkent date := (now() AT TIME ZONE 'Asia/Tashkent')::date;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;

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

  IF v_total > 0 AND v_score >= v_total THEN
    FOR v_hw IN
      SELECT a.id, a.recurrence
      FROM public.vocab_homework_assignments a
      WHERE a.target_type = 'quiz'
        AND a.quiz_id = p_quiz_id
        AND a.active
        AND a.starts_at <= now()
        AND (a.ends_at IS NULL OR a.ends_at >= now())
        AND (
          a.audience_type = 'all'
          OR (a.audience_type = 'class' AND public.bs_is_class_member(a.class_id, v_uid))
          OR (a.audience_type = 'users' AND public.bs_is_vocab_homework_assigned(a.id, v_uid))
        )
    LOOP
      v_period := CASE v_hw.recurrence
        WHEN 'once' THEN 'once'
        WHEN 'daily' THEN to_char(v_tashkent, 'YYYY-MM-DD')
        ELSE to_char(v_tashkent, 'IYYY-"W"IW')
      END;
      INSERT INTO public.vocab_homework_completions (
        assignment_id, user_id, period_key, quiz_score, quiz_total, status, completed_at
      )
      VALUES (v_hw.id, v_uid, v_period, v_score, v_total, 'completed', now())
      ON CONFLICT (assignment_id, user_id, period_key) DO UPDATE
        SET quiz_score = EXCLUDED.quiz_score,
            quiz_total = EXCLUDED.quiz_total,
            status = 'completed',
            completed_at = COALESCE(public.vocab_homework_completions.completed_at, now());
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'score', v_score,
    'total', v_total,
    'percent', round(100.0 * v_score / v_total)::int,
    'missed_card_ids', to_jsonb(v_missed),
    'results', v_results
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Protect shared lesson_video_catalog from non-staff overwrites
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.bs_upsert_lesson_video(
  p_video_id text,
  p_title text,
  p_youtube_url text,
  p_duration_seconds integer DEFAULT NULL::integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vid text := nullif(trim(coalesce(p_video_id, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF vid IS NULL THEN
    vid := public.bs_youtube_video_id(p_youtube_url);
  END IF;
  IF vid IS NULL OR nullif(trim(coalesce(p_title, '')), '') IS NULL THEN
    RETURN;
  END IF;

  IF public.bs_is_staff() THEN
    INSERT INTO public.lesson_video_catalog AS c (
      youtube_video_id, title, youtube_url, duration_seconds
    )
    VALUES (
      vid,
      trim(p_title),
      coalesce(nullif(trim(coalesce(p_youtube_url, '')), ''), 'https://www.youtube.com/watch?v=' || vid),
      p_duration_seconds
    )
    ON CONFLICT (youtube_video_id) DO UPDATE
    SET
      title = EXCLUDED.title,
      youtube_url = EXCLUDED.youtube_url,
      duration_seconds = COALESCE(EXCLUDED.duration_seconds, c.duration_seconds);
  ELSE
    INSERT INTO public.lesson_video_catalog AS c (
      youtube_video_id, title, youtube_url, duration_seconds
    )
    VALUES (
      vid,
      trim(p_title),
      'https://www.youtube.com/watch?v=' || vid,
      p_duration_seconds
    )
    ON CONFLICT (youtube_video_id) DO UPDATE
    SET duration_seconds = COALESCE(c.duration_seconds, EXCLUDED.duration_seconds)
    WHERE c.duration_seconds IS NULL AND EXCLUDED.duration_seconds IS NOT NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_vote_lesson_video(p_video_id text, p_vote smallint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  vid text := nullif(trim(coalesce(p_video_id, '')), '');
  prev smallint;
  next_vote smallint;
  delta integer;
  new_score integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF vid IS NULL THEN
    RAISE EXCEPTION 'missing video id';
  END IF;
  IF p_vote IS NULL OR p_vote NOT IN (-1, 0, 1) THEN
    RAISE EXCEPTION 'invalid vote';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.lesson_video_catalog WHERE youtube_video_id = vid
  ) THEN
    RAISE EXCEPTION 'unknown video';
  END IF;

  SELECT v.vote INTO prev
  FROM public.lesson_video_votes v
  WHERE v.user_id = uid AND v.youtube_video_id = vid;

  next_vote := CASE WHEN p_vote = 0 THEN NULL ELSE p_vote END;
  delta := coalesce(next_vote, 0) - coalesce(prev, 0);

  IF next_vote IS NULL THEN
    DELETE FROM public.lesson_video_votes
    WHERE user_id = uid AND youtube_video_id = vid;
  ELSE
    INSERT INTO public.lesson_video_votes (user_id, youtube_video_id, vote)
    VALUES (uid, vid, next_vote)
    ON CONFLICT (user_id, youtube_video_id) DO UPDATE
    SET vote = EXCLUDED.vote;
  END IF;

  IF delta <> 0 THEN
    UPDATE public.lesson_video_catalog
    SET score = score + delta
    WHERE youtube_video_id = vid
    RETURNING score INTO new_score;
  ELSE
    SELECT score INTO new_score
    FROM public.lesson_video_catalog
    WHERE youtube_video_id = vid;
  END IF;

  RETURN jsonb_build_object(
    'score', coalesce(new_score, 0),
    'my_vote', coalesce(next_vote, 0)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Restrict open_direct_thread to directory peers + tighten thread members insert
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.open_direct_thread(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  my_id uuid := auth.uid();
BEGIN
  IF my_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Account is suspended' USING ERRCODE = '42501';
  END IF;
  IF p_other_user_id = my_id THEN
    RAISE EXCEPTION 'Cannot message yourself';
  END IF;
  IF NOT (
    public.bs_is_staff()
    OR EXISTS (SELECT 1 FROM public.chat_directory d WHERE d.id = p_other_user_id)
  ) THEN
    RAISE EXCEPTION 'You can only message classmates or your teachers';
  END IF;

  SELECT t.id INTO tid
  FROM public.chat_threads t
  WHERE t.kind = 'direct'
    AND EXISTS (SELECT 1 FROM public.chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = my_id)
    AND EXISTS (SELECT 1 FROM public.chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = p_other_user_id)
  LIMIT 1;

  IF tid IS NOT NULL THEN
    RETURN tid;
  END IF;

  INSERT INTO public.chat_threads (kind, title, created_by)
  VALUES ('direct', 'Direct message', my_id)
  RETURNING id INTO tid;

  INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES
    (tid, my_id),
    (tid, p_other_user_id);

  RETURN tid;
END;
$$;

DROP POLICY IF EXISTS "thread members insert self" ON public.chat_thread_members;
CREATE POLICY "thread members insert self"
  ON public.chat_thread_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.chat_threads t
        WHERE t.id = chat_thread_members.thread_id
          AND (
            (t.kind = 'class_group'::public.chat_thread_kind AND t.class_id IS NOT NULL AND public.bs_is_class_member(t.class_id))
            OR (t.kind = 'subject_group'::public.chat_thread_kind AND t.class_id IS NOT NULL AND t.subject IS NOT NULL AND public.bs_in_class_subject(t.class_id, t.subject))
            OR (t.kind = 'class_group'::public.chat_thread_kind AND t.class_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_groups g WHERE g.class_id = t.class_id AND public.bs_teaches_group(g.id)
            ))
            OR (t.kind = 'subject_group'::public.chat_thread_kind AND t.class_id IS NOT NULL AND t.subject IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_groups g WHERE g.class_id = t.class_id AND g.subject = t.subject AND public.bs_teaches_group(g.id)
            ))
          )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Scope question-images and lesson-uploads storage reads to published rows
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "lesson uploads read auth" ON storage.objects;
CREATE POLICY "lesson uploads read auth"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lesson-uploads'
    AND NOT public.bs_is_self_banned()
    AND (
      public.bs_is_staff()
      OR EXISTS (
        SELECT 1 FROM public.lessons l
        WHERE l.published IS TRUE
          AND (l.video_path = name OR l.video_path = 'lesson-uploads/' || name)
      )
    )
  );

DROP POLICY IF EXISTS "qimg read auth" ON storage.objects;
CREATE POLICY "qimg read auth"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND NOT public.bs_is_self_banned()
    AND (
      public.bs_is_staff()
      OR EXISTS (
        SELECT 1 FROM public.questions q
        WHERE q.published IS TRUE
          AND (
            q.image_url = name
            OR q.image_url LIKE '%' || name || '%'
            OR q.choices::text LIKE '%' || name || '%'
          )
      )
    )
  );

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261014000002', 'close_remaining_vulns')
ON CONFLICT (version) DO NOTHING;
