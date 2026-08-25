-- Purge placeholder / stub questions left in the bank from failed imports.
-- mock_exam_questions references questions with ON DELETE RESTRICT, so clear those first.
-- test_questions / daily_test_questions cascade; attempts SET NULL.

DELETE FROM public.mock_exam_questions
WHERE question_id IN (
  SELECT id FROM public.questions
  WHERE btrim(coalesce(question_text, '')) ILIKE 'MISSING QUESTION%'
);

DELETE FROM public.questions
WHERE btrim(coalesce(question_text, '')) ILIKE 'MISSING QUESTION%';
