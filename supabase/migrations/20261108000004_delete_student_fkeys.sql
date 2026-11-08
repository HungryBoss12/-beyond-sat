-- Deleting a login must not fail because a nullable "created by" still
-- points at that person. The row stays; the author becomes unknown.

ALTER TABLE public.questions DROP CONSTRAINT IF EXISTS questions_created_by_fkey;
ALTER TABLE public.questions
  ADD CONSTRAINT questions_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.daily_tests DROP CONSTRAINT IF EXISTS daily_tests_created_by_fkey;
ALTER TABLE public.daily_tests
  ADD CONSTRAINT daily_tests_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.mock_exams DROP CONSTRAINT IF EXISTS mock_exams_created_by_fkey;
ALTER TABLE public.mock_exams
  ADD CONSTRAINT mock_exams_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.student_discounts DROP CONSTRAINT IF EXISTS student_discounts_created_by_fkey;
ALTER TABLE public.student_discounts
  ADD CONSTRAINT student_discounts_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
