-- SEPTEMBER 2025 VERSION C · Module 1 (math) shipped with five questions that had no
-- answer key, so grade_answer() marked every response wrong. A student reported a
-- correct 23 on the triangle question being scored as a miss.
--
-- Keys below were read off each question's figure and text, and every one matches the
-- answer students most often chose (D, B, 15, 23, D). This sets the keys, then
-- re-grades the attempts already saved for those five questions and brings the
-- practice-session totals (score = correct_count for type 'practice') back in line.

UPDATE public.questions SET
  correct_choice_id = 'D',
  explanation = 'The lines are parallel, so the angle marked x pairs with the 75° angle as supplementary angles: 180° - 75° = 105°.'
WHERE id = '3229830c-4e0c-4d29-8a68-63c2d37107f5' AND correct_choice_id IS NULL;

UPDATE public.questions SET
  correct_choice_id = 'B',
  explanation = 'The line rises from about 210°F at 0 hours to about 580°F at 10 hours, so the slope is about 37, roughly 40°F per hour, and the temperature increases.'
WHERE id = '7304e3d1-818c-46f4-817d-279a939c24c9' AND correct_choice_id IS NULL;

UPDATE public.questions SET
  correct_grid_answers = ARRAY['15'],
  explanation = 'The initial deposit is the balance at x = 0 months, and the graph crosses the y-axis at 15.'
WHERE id = '835241f4-c1e2-4cbe-95c8-7939f54591c3'
  AND (correct_grid_answers IS NULL OR cardinality(correct_grid_answers) = 0);

UPDATE public.questions SET
  correct_choice_id = 'D',
  explanation = 'The graph crosses the x-axis at x = 2, so f(2) = 0.'
WHERE id = '2a49c1ff-434d-4f61-be44-e8522fbd4bc5' AND correct_choice_id IS NULL;

UPDATE public.questions SET
  correct_grid_answers = ARRAY['23'],
  explanation = 'KL is the side next to angle y and JL = 24 is the hypotenuse, so cos y = KL / 24 = 23/24 and KL = 23.'
WHERE id = '50c7f7af-2fb9-4f0e-bbb1-1a5042a4b57e'
  AND (correct_grid_answers IS NULL OR cardinality(correct_grid_answers) = 0);

-- Re-grade saved attempts for these five questions.
UPDATE public.attempts a
   SET is_correct = (a.selected_choice_id = q.correct_choice_id)
  FROM public.questions q
 WHERE q.id = a.question_id
   AND q.id IN ('3229830c-4e0c-4d29-8a68-63c2d37107f5',
                '7304e3d1-818c-46f4-817d-279a939c24c9',
                '2a49c1ff-434d-4f61-be44-e8522fbd4bc5')
   AND a.is_correct IS DISTINCT FROM (a.selected_choice_id = q.correct_choice_id);

UPDATE public.attempts a
   SET is_correct = COALESCE(public.bs_grid_values_match(a.grid_answer, q.correct_grid_answers[1]), false)
  FROM public.questions q
 WHERE q.id = a.question_id
   AND q.id IN ('835241f4-c1e2-4cbe-95c8-7939f54591c3',
                '50c7f7af-2fb9-4f0e-bbb1-1a5042a4b57e')
   AND a.grid_answer IS NOT NULL
   AND a.is_correct IS DISTINCT FROM COALESCE(public.bs_grid_values_match(a.grid_answer, q.correct_grid_answers[1]), false);

-- Practice sessions store the raw count as both score and correct_count.
UPDATE public.test_sessions s
   SET correct_count = c.n, score = c.n, updated_at = now()
  FROM (
    SELECT session_id, count(*) FILTER (WHERE is_correct) AS n
      FROM public.attempts
     WHERE session_id IN (
       SELECT session_id FROM public.attempts
        WHERE question_id IN ('3229830c-4e0c-4d29-8a68-63c2d37107f5',
                              '7304e3d1-818c-46f4-817d-279a939c24c9',
                              '835241f4-c1e2-4cbe-95c8-7939f54591c3',
                              '2a49c1ff-434d-4f61-be44-e8522fbd4bc5',
                              '50c7f7af-2fb9-4f0e-bbb1-1a5042a4b57e'))
     GROUP BY session_id
  ) c
 WHERE s.id = c.session_id
   AND s.type::text = 'practice'
   AND s.completed_at IS NOT NULL
   AND s.correct_count IS DISTINCT FROM c.n;
