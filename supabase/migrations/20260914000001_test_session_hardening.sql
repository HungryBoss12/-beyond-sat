-- Test sitting hardening:
-- 1) Unique attempts per session question (idempotent submit)
-- 2) grade_answer only for questions in the caller's in-progress session
-- 3) SAT grid-in: accept round-or-truncate to 4 decimal places

DELETE FROM public.attempts a
WHERE a.ctid IN (
  SELECT ctid FROM (
    SELECT ctid,
           ROW_NUMBER() OVER (
             PARTITION BY session_id, question_id
             ORDER BY created_at DESC, id DESC
           ) AS rn
      FROM public.attempts
     WHERE session_id IS NOT NULL
       AND question_id IS NOT NULL
  ) d
  WHERE rn > 1
);

ALTER TABLE public.attempts
  DROP CONSTRAINT IF EXISTS attempts_session_question_key;

ALTER TABLE public.attempts
  ADD CONSTRAINT attempts_session_question_key UNIQUE (session_id, question_id);

CREATE OR REPLACE FUNCTION public.bs_grid_values_match(p_given text, p_key text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  g double precision;
  k double precision;
  gt text;
  places int;
BEGIN
  IF p_given IS NULL OR p_key IS NULL THEN
    RETURN false;
  END IF;
  IF lower(btrim(p_given)) = lower(btrim(p_key)) THEN
    RETURN true;
  END IF;
  g := public.bs_parse_grid_number(p_given);
  k := public.bs_parse_grid_number(p_key);
  IF g IS NULL OR k IS NULL THEN
    RETURN false;
  END IF;
  IF abs(g - k) < 1e-9 THEN
    RETURN true;
  END IF;
  IF abs(round(g::numeric, 4) - round(k::numeric, 4)) < 1e-9 THEN
    RETURN true;
  END IF;
  IF trunc(g::numeric, 4) = trunc(k::numeric, 4) THEN
    RETURN true;
  END IF;
  gt := btrim(p_given);
  IF gt ~ '\.[0-9]{4}' THEN
    places := 4;
  ELSIF gt ~ '\.[0-9]{3}' THEN
    places := 3;
  ELSE
    RETURN false;
  END IF;
  IF abs(round(g::numeric, places) - round(k::numeric, places)) < 1e-9 THEN
    RETURN true;
  END IF;
  IF trunc(g::numeric, places) = trunc(k::numeric, places) THEN
    RETURN true;
  END IF;
  RETURN false;
END;
$$;

DROP FUNCTION IF EXISTS public.grade_answer(uuid, text, text);

CREATE FUNCTION public.grade_answer(
  p_question_id uuid,
  p_choice_id text,
  p_grid_answer text,
  p_session_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT public.bs_is_staff() THEN
    IF NOT EXISTS (
      SELECT 1
        FROM public.test_sessions s
       WHERE s.user_id = auth.uid()
         AND s.completed_at IS NULL
         AND (p_session_id IS NULL OR s.id = p_session_id)
         AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text)
    ) THEN
      RAISE EXCEPTION 'Question is not in an active session';
    END IF;
  END IF;

  SELECT kind, correct_choice_id, correct_grid_answers
    INTO q
    FROM public.questions
   WHERE id = p_question_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;
  IF q.kind = 'grid_in' THEN
    IF p_grid_answer IS NULL OR btrim(p_grid_answer) = '' THEN
      RETURN NULL;
    END IF;
    RETURN EXISTS (
      SELECT 1
        FROM unnest(coalesce(q.correct_grid_answers, ARRAY[]::text[])) v
       WHERE public.bs_grid_values_match(p_grid_answer, v)
    );
  ELSE
    IF p_choice_id IS NULL THEN RETURN NULL; END IF;
    RETURN p_choice_id = q.correct_choice_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_answer(uuid, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_grid_values_match(text, text) TO authenticated;
