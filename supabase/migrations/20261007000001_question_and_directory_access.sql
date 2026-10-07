-- Students could page every question stem and the whole chat directory.
-- Unpublished rows stay visible to staff. Classmates share a class or a group.
-- The directory view stays security-invoker false so the class filter can see
-- memberships; the WHERE clause is what limits the rows.

DROP POLICY IF EXISTS "Authenticated read questions" ON public.questions;
CREATE POLICY "questions read published or staff"
  ON public.questions
  FOR SELECT
  TO authenticated
  USING (public.bs_is_staff() OR published IS TRUE);

DROP POLICY IF EXISTS "tq read auth" ON public.test_questions;
CREATE POLICY "tq read auth"
  ON public.test_questions
  FOR SELECT
  TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1
      FROM public.tests t
      WHERE t.id = test_questions.test_id
        AND t.published IS TRUE
        AND t.in_test_base IS NOT TRUE
    )
  );

DROP VIEW IF EXISTS public.chat_directory;
CREATE VIEW public.chat_directory
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.username,
  p.avatar_url,
  p.telegram_username,
  p.telegram_connected_at,
  p.chat_setup_completed,
  p.class_id,
  p.full_name,
  p.first_name,
  p.last_name
FROM public.profiles p
WHERE p.username IS NOT NULL
  AND p.chat_setup_completed IS TRUE
  AND p.banned IS NOT TRUE
  AND (
    public.bs_is_staff()
    OR p.id = auth.uid()
    OR public.bs_teaches_student(p.id)
    OR EXISTS (
      SELECT 1
      FROM public.class_group_memberships mine
      JOIN public.class_group_memberships theirs
        ON theirs.class_id = mine.class_id
       AND theirs.user_id = p.id
       AND theirs.status <> 'left'
      WHERE mine.user_id = auth.uid()
        AND mine.status <> 'left'
    )
    OR EXISTS (
      SELECT 1
      FROM public.class_group_memberships mine
      JOIN public.class_groups g ON g.id = mine.group_id
      WHERE mine.user_id = auth.uid()
        AND mine.status <> 'left'
        AND g.teacher_id = p.id
    )
  );

REVOKE ALL ON public.chat_directory FROM PUBLIC, anon;
GRANT SELECT ON public.chat_directory TO authenticated;

DO $$
BEGIN
  IF to_regprocedure('public.grade_answer(uuid, text, text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.grade_answer(uuid, text, text, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text, uuid) FROM PUBLIC, anon;
  END IF;
  IF to_regprocedure('public.get_attempt_feedback(uuid, uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_attempt_feedback(uuid, uuid) FROM PUBLIC, anon;
  END IF;
END $$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261007000001', 'question_and_directory_access')
ON CONFLICT (version) DO NOTHING;
