-- A teacher is not staff. bs_is_staff stays admin and editor.
-- bs_teaches_group is true for an admin, or for a teacher assigned to that group.

CREATE OR REPLACE FUNCTION public.bs_teaches_group(p_group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p_group_id IS NOT NULL AND (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1
      FROM public.class_groups g
      JOIN public.user_roles r ON r.user_id = auth.uid() AND r.role = 'teacher'
      WHERE g.id = p_group_id
        AND g.teacher_id = auth.uid()
    )
  );
$$;

REVOKE ALL ON FUNCTION public.bs_teaches_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_teaches_group(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bs_teaches_student(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.class_group_memberships m
    WHERE m.user_id = p_user_id
      AND public.bs_teaches_group(m.group_id)
  );
$$;

REVOKE ALL ON FUNCTION public.bs_teaches_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_teaches_student(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_set_role(p_user_id uuid, p_role text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can change roles';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot change your own role';
  END IF;
  IF p_role NOT IN ('student', 'editor', 'admin', 'teacher') THEN
    RAISE EXCEPTION 'Unknown role: %', p_role;
  END IF;

  DELETE FROM public.user_roles
   WHERE user_id = p_user_id AND role IN ('admin', 'editor', 'teacher');

  IF p_role = 'teacher' THEN
    DELETE FROM public.user_roles
     WHERE user_id = p_user_id AND role = 'student';
  END IF;

  IF p_role <> 'student' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (p_user_id, p_role::public.app_role)
    ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

-- Read their groups, the students in them, and the classroom rows.
DROP POLICY IF EXISTS "groups read staff or member" ON public.class_groups;
CREATE POLICY "groups read staff or member" ON public.class_groups
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_group_member(id)
    OR public.bs_teaches_group(id)
  );

DROP POLICY IF EXISTS "group memberships read own or staff" ON public.class_group_memberships;
CREATE POLICY "group memberships read own or staff" ON public.class_group_memberships
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "class lessons read" ON public.class_lessons;
CREATE POLICY "class lessons read" ON public.class_lessons
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_group_member(group_id)
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "class lessons staff write" ON public.class_lessons;
CREATE POLICY "class lessons staff write" ON public.class_lessons
  FOR ALL TO authenticated
  USING (public.bs_is_staff() OR public.bs_teaches_group(group_id))
  WITH CHECK (public.bs_is_staff() OR public.bs_teaches_group(group_id));

DROP POLICY IF EXISTS "attendance read own or staff" ON public.lesson_attendance;
CREATE POLICY "attendance read own or staff" ON public.lesson_attendance
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "attendance staff write" ON public.lesson_attendance;
CREATE POLICY "attendance staff write" ON public.lesson_attendance
  FOR ALL TO authenticated
  USING (public.bs_is_staff() OR public.bs_teaches_group(group_id))
  WITH CHECK (public.bs_is_staff() OR public.bs_teaches_group(group_id));

DROP POLICY IF EXISTS "hw marks read own or staff" ON public.lesson_hw_marks;
CREATE POLICY "hw marks read own or staff" ON public.lesson_hw_marks
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "hw marks staff write" ON public.lesson_hw_marks;
CREATE POLICY "hw marks staff write" ON public.lesson_hw_marks
  FOR ALL TO authenticated
  USING (public.bs_is_staff() OR public.bs_teaches_group(group_id))
  WITH CHECK (public.bs_is_staff() OR public.bs_teaches_group(group_id));

DROP POLICY IF EXISTS "results read own or staff" ON public.lesson_results;
CREATE POLICY "results read own or staff" ON public.lesson_results
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "level scores read own or staff" ON public.student_level_scores;
CREATE POLICY "level scores read own or staff" ON public.student_level_scores
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "scores read own or staff" ON public.student_scores;
CREATE POLICY "scores read own or staff" ON public.student_scores
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR public.bs_teaches_student(user_id)
  );

DROP POLICY IF EXISTS "teachers read their students" ON public.profiles;
CREATE POLICY "teachers read their students" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.bs_teaches_student(id));

DROP POLICY IF EXISTS "threads read members" ON public.chat_threads;
CREATE POLICY "threads read members" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_thread_member(id)
    OR (kind = 'class_group' AND class_id IS NOT NULL AND public.bs_is_class_member(class_id))
    OR (kind = 'subject_group' AND class_id IS NOT NULL AND subject IS NOT NULL
        AND public.bs_in_class_subject(class_id, subject))
    OR (kind = 'class_group' AND class_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = chat_threads.class_id AND public.bs_teaches_group(g.id)
    ))
    OR (kind = 'subject_group' AND class_id IS NOT NULL AND subject IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = chat_threads.class_id
        AND g.subject = chat_threads.subject
        AND public.bs_teaches_group(g.id)
    ))
  );

DROP POLICY IF EXISTS "thread members insert self" ON public.chat_thread_members;
CREATE POLICY "thread members insert self" ON public.chat_thread_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_thread_members.thread_id
          AND (
            (t.kind = 'class_group' AND t.class_id IS NOT NULL AND public.bs_is_class_member(t.class_id))
            OR (t.kind = 'subject_group' AND t.class_id IS NOT NULL AND t.subject IS NOT NULL
                AND public.bs_in_class_subject(t.class_id, t.subject))
            OR (t.kind = 'direct' AND t.created_by = auth.uid())
            OR (t.kind = 'class_group' AND t.class_id IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_groups g
              WHERE g.class_id = t.class_id AND public.bs_teaches_group(g.id)
            ))
            OR (t.kind = 'subject_group' AND t.class_id IS NOT NULL AND t.subject IS NOT NULL AND EXISTS (
              SELECT 1 FROM public.class_groups g
              WHERE g.class_id = t.class_id
                AND g.subject = t.subject
                AND public.bs_teaches_group(g.id)
            ))
          )
      )
    )
  );

DROP POLICY IF EXISTS "students staff read" ON public.students;
CREATE POLICY "students staff read" ON public.students
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR (user_id IS NOT NULL AND public.bs_teaches_student(user_id))
  );

DROP POLICY IF EXISTS "hw read class or staff" ON public.homework_assignments;
CREATE POLICY "hw read class or staff" ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_group_member(group_id)
    OR public.bs_teaches_group(group_id)
  );

DROP POLICY IF EXISTS "hw staff write" ON public.homework_assignments;
CREATE POLICY "hw staff write" ON public.homework_assignments
  FOR ALL TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = homework_assignments.class_id
        AND g.subject = homework_assignments.subject
        AND public.bs_teaches_group(g.id)
    )
  )
  WITH CHECK (
    public.bs_is_staff()
    OR public.bs_teaches_group(group_id)
    OR EXISTS (
      SELECT 1 FROM public.class_groups g
      WHERE g.class_id = homework_assignments.class_id
        AND g.subject = homework_assignments.subject
        AND public.bs_teaches_group(g.id)
    )
  );

DROP POLICY IF EXISTS "hw files staff write" ON public.homework_files;
CREATE POLICY "hw files staff write" ON public.homework_files
  FOR ALL TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id AND public.bs_teaches_group(a.group_id)
    )
  )
  WITH CHECK (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id AND public.bs_teaches_group(a.group_id)
    )
  );

DROP POLICY IF EXISTS "hw sub read own or staff" ON public.homework_submissions;
CREATE POLICY "hw sub read own or staff" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (
    student_id = auth.uid()
    OR public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id AND public.bs_teaches_group(a.group_id)
    )
  );

DROP POLICY IF EXISTS "hw sub update own or staff" ON public.homework_submissions;
CREATE POLICY "hw sub update own or staff" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (
    student_id = auth.uid()
    OR public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id AND public.bs_teaches_group(a.group_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    OR public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id AND public.bs_teaches_group(a.group_id)
    )
  );

-- Workspace writes. Editors stay on bs_is_staff. Teachers only for their group.
CREATE OR REPLACE FUNCTION public.ensure_group_lessons(p_group_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  RETURN public._bs_ensure_group_lessons(p_group_id, p_month);
END;
$$;

CREATE OR REPLACE FUNCTION public.set_group_attendance(
  p_group_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  PERFORM public._bs_set_group_attendance(p_group_id, p_user_id, p_lesson_date, p_state);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_hw_marks(
  p_lesson_id uuid,
  p_user_ids uuid[],
  p_item public.hw_item,
  p_done boolean
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
  v_count int;
BEGIN
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_lesson.group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
  SELECT p_lesson_id, u, p_item, v_lesson.group_id, COALESCE(p_done, false), 'manual', auth.uid(), now()
  FROM public._bs_live_members(v_lesson.group_id, p_user_ids) AS u
  ON CONFLICT (lesson_id, user_id, item) DO UPDATE
    SET done = EXCLUDED.done, source = 'manual', updated_by = auth.uid(), updated_at = now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.tick_all_complete(p_lesson_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
  v_uid uuid;
BEGIN
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_lesson.group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  FOR v_uid IN SELECT * FROM public._bs_live_members(v_lesson.group_id, p_user_ids) LOOP
    PERFORM public._bs_set_group_attendance(v_lesson.group_id, v_uid, v_lesson.lesson_date, 'present');
    INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
    SELECT p_lesson_id, v_uid, i, v_lesson.group_id, true, 'manual', auth.uid(), now()
    FROM unnest(public.bs_scheme_items(v_lesson.subject)) AS i
    ON CONFLICT (lesson_id, user_id, item) DO UPDATE
      SET done = true, source = 'manual', updated_by = auth.uid(), updated_at = now();
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.untick_all(p_lesson_id uuid, p_user_ids uuid[])
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson public.class_lessons%ROWTYPE;
BEGIN
  SELECT * INTO v_lesson FROM public.class_lessons WHERE id = p_lesson_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_lesson.group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id, done, source, updated_by, updated_at)
  SELECT p_lesson_id, u, i, v_lesson.group_id, false, 'manual', auth.uid(), now()
  FROM public._bs_live_members(v_lesson.group_id, p_user_ids) AS u
  CROSS JOIN unnest(public.bs_scheme_items(v_lesson.subject)) AS i
  ON CONFLICT (lesson_id, user_id, item) DO UPDATE
    SET done = false, source = 'manual', updated_by = auth.uid(), updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_result(
  p_lesson_id uuid,
  p_user_id uuid,
  p_m1 integer,
  p_m2 integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  SELECT group_id INTO v_group FROM public.class_lessons WHERE id = p_lesson_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_group)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF (p_m1 IS NOT NULL AND (p_m1 < 0 OR p_m1 > 27)) OR (p_m2 IS NOT NULL AND (p_m2 < 0 OR p_m2 > 27)) THEN
    RAISE EXCEPTION 'M1 and M2 must be whole numbers from 0 to 27';
  END IF;
  IF p_m1 IS NULL AND p_m2 IS NULL THEN
    DELETE FROM public.lesson_results WHERE lesson_id = p_lesson_id AND user_id = p_user_id;
    RETURN;
  END IF;
  IF NOT public._bs_group_member(v_group, p_user_id) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  INSERT INTO public.lesson_results (lesson_id, user_id, group_id, m1, m2, updated_by, updated_at)
  VALUES (p_lesson_id, p_user_id, v_group, p_m1, p_m2, auth.uid(), now())
  ON CONFLICT (lesson_id, user_id) DO UPDATE
    SET m1 = EXCLUDED.m1, m2 = EXCLUDED.m2, updated_by = EXCLUDED.updated_by, updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_save_level_scores(
  p_group_id uuid,
  p_user_id uuid,
  p_assessed_on date,
  p_scores jsonb,
  p_lesson_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject public.class_subject;
  v_date date := COALESCE(p_assessed_on, public.bs_tashkent_today());
  v_key text;
  v_val jsonb;
  v_num numeric;
  v_section uuid;
  v_count int := 0;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT subject INTO v_subject FROM public.class_groups WHERE id = p_group_id;
  IF v_subject IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  IF p_scores IS NULL OR jsonb_typeof(p_scores) <> 'object' THEN
    RAISE EXCEPTION 'Scores must be an object of section slug to score';
  END IF;
  IF p_lesson_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.class_lessons WHERE id = p_lesson_id AND group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'That lesson is not in this sub-class';
  END IF;
  FOR v_key, v_val IN SELECT * FROM jsonb_each(p_scores) LOOP
    SELECT id INTO v_section FROM public.level_sections
    WHERE subject = v_subject AND slug = v_key AND active;
    IF v_section IS NULL THEN
      RAISE EXCEPTION 'Unknown section: %', v_key;
    END IF;
    IF jsonb_typeof(v_val) <> 'number' THEN
      RAISE EXCEPTION 'Score for % must be a whole number from 400 to 1000', v_key;
    END IF;
    v_num := (v_val #>> '{}')::numeric;
    IF v_num <> trunc(v_num) OR v_num < 400 OR v_num > 1000 THEN
      RAISE EXCEPTION 'Score for % must be a whole number from 400 to 1000', v_key;
    END IF;
    INSERT INTO public.student_level_scores (user_id, group_id, section_id, score, assessed_on, lesson_id, created_by)
    VALUES (p_user_id, p_group_id, v_section, v_num::smallint, v_date, p_lesson_id, auth.uid());
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_void_level_score(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  SELECT group_id INTO v_group FROM public.student_level_scores WHERE id = p_id AND voided_at IS NULL;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Score not found or already voided';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_group)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason required';
  END IF;
  UPDATE public.student_level_scores
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_id AND voided_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_level_board(p_group_id uuid)
RETURNS TABLE (
  user_id uuid,
  scores jsonb,
  overall integer,
  scored integer,
  sections integer,
  last_assessed_on date,
  previous_overall integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject public.class_subject;
  v_sections int;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT subject INTO v_subject FROM public.class_groups WHERE id = p_group_id;
  SELECT count(*)::int INTO v_sections FROM public.level_sections WHERE subject = v_subject AND active;
  RETURN QUERY
  WITH live AS (
    SELECT s.user_id, s.section_id, s.score, s.assessed_on, s.created_at, ls.slug, ls.weight
    FROM public.student_level_scores s
    JOIN public.level_sections ls ON ls.id = s.section_id
    WHERE s.group_id = p_group_id AND s.voided_at IS NULL AND ls.active
  ),
  cur AS (
    SELECT DISTINCT ON (l.user_id, l.section_id) l.*
    FROM live l
    ORDER BY l.user_id, l.section_id, l.assessed_on DESC, l.created_at DESC
  ),
  last_date AS (
    SELECT l.user_id, max(l.assessed_on) AS d FROM live l GROUP BY l.user_id
  ),
  prev AS (
    SELECT DISTINCT ON (l.user_id, l.section_id) l.*
    FROM live l
    JOIN last_date ld ON ld.user_id = l.user_id AND l.assessed_on < ld.d
    ORDER BY l.user_id, l.section_id, l.assessed_on DESC, l.created_at DESC
  )
  SELECT
    m.user_id,
    COALESCE((
      SELECT jsonb_object_agg(c.slug, jsonb_build_object('score', c.score, 'assessed_on', c.assessed_on))
      FROM cur c WHERE c.user_id = m.user_id
    ), '{}'::jsonb),
    (SELECT public.bs_level_overall(array_agg(c.score::int), array_agg(c.weight::int)) FROM cur c WHERE c.user_id = m.user_id),
    (SELECT count(*)::int FROM cur c WHERE c.user_id = m.user_id),
    v_sections,
    (SELECT ld.d FROM last_date ld WHERE ld.user_id = m.user_id),
    (SELECT public.bs_level_overall(array_agg(p.score::int), array_agg(p.weight::int)) FROM prev p WHERE p.user_id = m.user_id)
  FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.status <> 'left';
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT 'active',
  p_enrolled_on date DEFAULT NULL,
  p_activated_on date DEFAULT NULL,
  p_move boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_other uuid;
  v_existing public.class_group_memberships%ROWTYPE;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_move AND NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_activated_on IS NOT NULL AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;

  SELECT class_id INTO v_other FROM public.class_memberships
  WHERE user_id = p_user_id AND class_id <> v_class;
  IF v_other IS NOT NULL THEN
    IF NOT p_move THEN
      RAISE EXCEPTION 'already_in_other_class';
    END IF;
    DELETE FROM public.class_memberships WHERE user_id = p_user_id AND class_id = v_other;
  END IF;

  SELECT * INTO v_existing FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF FOUND AND p_enrolled_on IS NOT NULL AND p_enrolled_on IS DISTINCT FROM v_existing.enrolled_on
     AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, p_enrolled_on, p_activated_on);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_group_member_status(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, NULL, NULL);
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_remove_group_member(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  DELETE FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_set_student_score(
  p_user_id uuid,
  p_rw integer,
  p_math integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rw int;
  v_math int;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_student(p_user_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  v_rw := LEAST(800, GREATEST(200, ROUND(COALESCE(p_rw, 200))::int));
  v_math := LEAST(800, GREATEST(200, ROUND(COALESCE(p_math, 200))::int));
  INSERT INTO public.student_scores (user_id, rw, math, updated_by, updated_at)
  VALUES (p_user_id, v_rw, v_math, auth.uid(), now())
  ON CONFLICT (user_id) DO UPDATE SET
    rw = EXCLUDED.rw,
    math = EXCLUDED.math,
    updated_by = EXCLUDED.updated_by,
    updated_at = now();
END;
$$;
