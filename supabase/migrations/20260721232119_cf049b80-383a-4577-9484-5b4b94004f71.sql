
-- 1) Move has_role to private schema (removes anon/authenticated executable SECURITY DEFINER in public API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;

-- Ensure execute grants remain for policy usage (policies follow the function OID across schema move)
REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated, service_role;

-- 2) Lock down app_settings and expose only the Desmos key via a safe function
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

CREATE POLICY "Admins can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_desmos_api_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_settings WHERE key = 'desmos_api_key';
$$;

REVOKE ALL ON FUNCTION public.get_desmos_api_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_desmos_api_key() TO authenticated;

-- 3) Hide answer key on questions from regular authenticated users using column-level grants.
--    (Admins are also authenticated; they use SECURITY DEFINER RPCs below to read/write answers.)
REVOKE SELECT ON public.questions FROM authenticated;
GRANT SELECT (
  id, section, skill, difficulty, kind, prompt, question_text, choices,
  image_url, created_by, created_at, updated_at, source_month, source_year,
  time_limit_seconds
) ON public.questions TO authenticated;
-- Admin write/update/delete still governed by RLS policies
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;

-- Grading RPC used by the test player
CREATE OR REPLACE FUNCTION public.grade_answer(
  p_question_id uuid,
  p_choice_id text,
  p_grid_answer text
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
      SELECT 1 FROM unnest(coalesce(q.correct_grid_answers, ARRAY[]::text[])) v
      WHERE lower(btrim(v)) = lower(btrim(p_grid_answer))
    );
  ELSE
    IF p_choice_id IS NULL THEN RETURN NULL; END IF;
    RETURN p_choice_id = q.correct_choice_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_answer(uuid, text, text) TO authenticated;

-- Review answers: only for questions the caller has already answered in a completed session
CREATE OR REPLACE FUNCTION public.get_answers_for_review(p_question_ids uuid[])
RETURNS TABLE(
  question_id uuid,
  correct_choice_id text,
  correct_grid_answers text[],
  explanation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.correct_choice_id, q.correct_grid_answers, q.explanation
    FROM public.questions q
   WHERE q.id = ANY(p_question_ids)
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

REVOKE ALL ON FUNCTION public.get_answers_for_review(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_answers_for_review(uuid[]) TO authenticated;

-- Admin RPC to fetch answer key for editing
CREATE OR REPLACE FUNCTION public.admin_get_question_answers(p_question_id uuid)
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
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT q.correct_choice_id, q.correct_grid_answers, q.explanation
      FROM public.questions q
     WHERE q.id = p_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_question_answers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_question_answers(uuid) TO authenticated;
