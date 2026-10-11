-- A lesson's Results grid was two boxes. Pre-SAT sittings need up to seven
-- passages, counted per lesson so the rest of the month stays at two.

ALTER TABLE public.class_lessons
  ADD COLUMN IF NOT EXISTS result_slots smallint NOT NULL DEFAULT 2;

ALTER TABLE public.class_lessons
  DROP CONSTRAINT IF EXISTS class_lessons_result_slots_range;
ALTER TABLE public.class_lessons
  ADD CONSTRAINT class_lessons_result_slots_range CHECK (result_slots BETWEEN 2 AND 7);

ALTER TABLE public.lesson_results
  ADD COLUMN IF NOT EXISTS scores smallint[];

UPDATE public.lesson_results
SET scores = ARRAY[m1, m2]::smallint[]
WHERE scores IS NULL;

ALTER TABLE public.lesson_results
  DROP CONSTRAINT IF EXISTS lesson_results_not_empty;

CREATE OR REPLACE FUNCTION public.lesson_result_filled(
  p_m1 integer,
  p_m2 integer,
  p_scores smallint[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_m1 IS NOT NULL
    OR p_m2 IS NOT NULL
    OR COALESCE((SELECT bool_or(s IS NOT NULL) FROM unnest(p_scores) AS s), false);
$$;

ALTER TABLE public.lesson_results
  ADD CONSTRAINT lesson_results_not_empty
  CHECK (public.lesson_result_filled(m1, m2, scores));

DROP FUNCTION IF EXISTS public.staff_set_result(uuid, uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.staff_set_result(
  p_lesson_id uuid,
  p_user_id uuid,
  p_scores integer[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_subject public.class_subject;
  v_slots smallint;
  v_max integer;
  v_score integer;
  v_any boolean := false;
BEGIN
  SELECT l.group_id, l.subject, l.result_slots
    INTO v_group, v_subject, v_slots
  FROM public.class_lessons l
  WHERE l.id = p_lesson_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_group)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_scores IS NULL OR cardinality(p_scores) <> v_slots THEN
    RAISE EXCEPTION 'This lesson has % passage(s)', v_slots;
  END IF;
  v_max := CASE WHEN v_subject = 'math' THEN 22 ELSE 27 END;
  FOREACH v_score IN ARRAY p_scores LOOP
    IF v_score IS NULL THEN
      CONTINUE;
    END IF;
    v_any := true;
    IF v_score < 0 OR v_score > v_max THEN
      RAISE EXCEPTION 'Each passage must be a whole number from 0 to %', v_max;
    END IF;
  END LOOP;
  IF NOT v_any THEN
    DELETE FROM public.lesson_results WHERE lesson_id = p_lesson_id AND user_id = p_user_id;
    RETURN;
  END IF;
  IF NOT public._bs_group_member(v_group, p_user_id) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  INSERT INTO public.lesson_results (
    lesson_id, user_id, group_id, m1, m2, scores, updated_by, updated_at
  )
  VALUES (
    p_lesson_id,
    p_user_id,
    v_group,
    p_scores[1],
    p_scores[2],
    p_scores::smallint[],
    auth.uid(),
    now()
  )
  ON CONFLICT (lesson_id, user_id) DO UPDATE
    SET m1 = EXCLUDED.m1,
        m2 = EXCLUDED.m2,
        scores = EXCLUDED.scores,
        updated_by = EXCLUDED.updated_by,
        updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_result(uuid, uuid, integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_result(uuid, uuid, integer[]) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.staff_set_result_slots(
  p_lesson_id uuid,
  p_slots smallint
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_current smallint;
BEGIN
  SELECT group_id, result_slots INTO v_group, v_current
  FROM public.class_lessons
  WHERE id = p_lesson_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
  END IF;
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(v_group)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_slots < 2 OR p_slots > 7 THEN
    RAISE EXCEPTION 'A lesson has 2 to 7 passages';
  END IF;
  IF p_slots < v_current AND EXISTS (
    SELECT 1
    FROM public.lesson_results r
    WHERE r.lesson_id = p_lesson_id
      AND EXISTS (
        SELECT 1
        FROM generate_series(p_slots + 1, COALESCE(cardinality(r.scores), 0)) AS i
        WHERE r.scores[i] IS NOT NULL
      )
  ) THEN
    RAISE EXCEPTION 'Clear the last passage before removing it';
  END IF;
  UPDATE public.lesson_results
  SET scores = scores[1:p_slots],
      m1 = scores[1],
      m2 = CASE WHEN p_slots >= 2 THEN scores[2] ELSE NULL END
  WHERE lesson_id = p_lesson_id
    AND scores IS NOT NULL
    AND cardinality(scores) > p_slots;
  UPDATE public.class_lessons
  SET result_slots = p_slots
  WHERE id = p_lesson_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_result_slots(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_result_slots(uuid, smallint) TO authenticated, service_role;
