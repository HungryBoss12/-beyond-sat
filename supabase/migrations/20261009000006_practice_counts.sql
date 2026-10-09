-- Practice pages counted questions by loading rows, which stops at 1000.
-- Runs with the caller's rights, so the counts match what the student can open.

CREATE OR REPLACE FUNCTION public.practice_counts()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'questions', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'section', q.section::text,
        'bank_format', q.bank_format,
        'difficulty', q.difficulty::text,
        'n', q.n
      ))
      FROM (
        SELECT section, bank_format, difficulty, count(*)::integer AS n
        FROM public.questions
        GROUP BY section, bank_format, difficulty
      ) q
    ), '[]'::jsonb),
    'mocks', (SELECT count(*)::integer FROM public.mock_exams WHERE published IS TRUE),
    'sqb_tests', (
      SELECT count(*)::integer FROM public.tests
      WHERE bank_format = 'sqb' AND published IS TRUE AND in_test_base IS FALSE
    )
  );
$$;

REVOKE ALL ON FUNCTION public.practice_counts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.practice_counts() TO authenticated, service_role;
