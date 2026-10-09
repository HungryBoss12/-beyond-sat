-- Admin screens deleted a list and then inserted the new one as two requests.
-- When the insert failed the list was simply gone. Each function below runs as
-- one statement batch, so a failed insert rolls the delete back too.

CREATE OR REPLACE FUNCTION public.staff_replace_test_questions(
  p_test_id uuid,
  p_question_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.test_questions WHERE test_id = p_test_id;
  INSERT INTO public.test_questions (test_id, question_id, position)
  SELECT p_test_id, q.id, q.ord::integer
  FROM unnest(coalesce(p_question_ids, '{}'::uuid[])) WITH ORDINALITY AS q(id, ord);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_replace_daily_tests(
  p_daily_test_id uuid,
  p_test_ids uuid[]
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.daily_test_tests WHERE daily_test_id = p_daily_test_id;
  INSERT INTO public.daily_test_tests (daily_test_id, test_id, position)
  SELECT p_daily_test_id, t.id, t.ord::integer
  FROM unnest(coalesce(p_test_ids, '{}'::uuid[])) WITH ORDINALITY AS t(id, ord);
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_replace_mock_sections(
  p_mock_id uuid,
  p_rows jsonb
)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'staff only' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.mock_exam_sections WHERE mock_exam_id = p_mock_id;
  INSERT INTO public.mock_exam_sections (mock_exam_id, module, section_index, section_name, test_id)
  SELECT p_mock_id,
         (r->>'module')::integer,
         (r->>'section_index')::integer,
         r->>'section_name',
         (r->>'test_id')::uuid
  FROM jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) AS r;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_replace_test_questions(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_replace_daily_tests(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_replace_mock_sections(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_replace_test_questions(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_replace_daily_tests(uuid, uuid[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.staff_replace_mock_sections(uuid, jsonb) TO authenticated, service_role;
