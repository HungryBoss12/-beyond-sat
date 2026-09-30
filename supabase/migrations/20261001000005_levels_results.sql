-- Level scores (400-1000 per section, append-only) and per-lesson Results (M1 + M2).

CREATE TABLE IF NOT EXISTS public.student_level_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  section_id uuid NOT NULL REFERENCES public.level_sections(id),
  score smallint NOT NULL CHECK (score BETWEEN 400 AND 1000),
  assessed_on date NOT NULL,
  lesson_id uuid REFERENCES public.class_lessons(id) ON DELETE SET NULL,
  note text CHECK (note IS NULL OR char_length(note) <= 200),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text
);

CREATE INDEX IF NOT EXISTS student_level_scores_lookup_idx
  ON public.student_level_scores (group_id, user_id, section_id, assessed_on DESC, created_at DESC);

CREATE OR REPLACE FUNCTION public.student_level_scores_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group_subject public.class_subject;
  v_section_subject public.class_subject;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Level scores cannot be deleted. Void them instead.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Voided scores cannot be changed';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.section_id IS DISTINCT FROM OLD.section_id
       OR NEW.score IS DISTINCT FROM OLD.score
       OR NEW.assessed_on IS DISTINCT FROM OLD.assessed_on
       OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Level scores are append-only. Void and re-enter instead.';
    END IF;
    IF NEW.voided_at IS NOT NULL AND COALESCE(btrim(NEW.void_reason), '') = '' THEN
      RAISE EXCEPTION 'Void reason required';
    END IF;
    RETURN NEW;
  END IF;
  SELECT subject INTO v_group_subject FROM public.class_groups WHERE id = NEW.group_id;
  SELECT subject INTO v_section_subject FROM public.level_sections WHERE id = NEW.section_id;
  IF v_group_subject IS DISTINCT FROM v_section_subject THEN
    RAISE EXCEPTION 'That section belongs to the other subject';
  END IF;
  IF NOT public._bs_group_member(NEW.group_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF NEW.assessed_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Assessment date cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS student_level_scores_guard ON public.student_level_scores;
CREATE TRIGGER student_level_scores_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.student_level_scores
  FOR EACH ROW EXECUTE FUNCTION public.student_level_scores_guard();

ALTER TABLE public.student_level_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "level scores read own or staff" ON public.student_level_scores;
CREATE POLICY "level scores read own or staff" ON public.student_level_scores
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

GRANT SELECT ON public.student_level_scores TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_level_scores FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.student_level_scores TO service_role;

CREATE OR REPLACE VIEW public.student_level_current
WITH (security_invoker = true) AS
SELECT DISTINCT ON (s.user_id, s.group_id, s.section_id)
  s.user_id, s.group_id, s.section_id, ls.slug, ls.weight, s.score, s.assessed_on, s.id AS score_id
FROM public.student_level_scores s
JOIN public.level_sections ls ON ls.id = s.section_id
WHERE s.voided_at IS NULL AND ls.active
ORDER BY s.user_id, s.group_id, s.section_id, s.assessed_on DESC, s.created_at DESC;

GRANT SELECT ON public.student_level_current TO authenticated;

-- Weighted mean over scored sections, half-up. NULL when nothing is scored.
CREATE OR REPLACE FUNCTION public.bs_level_overall(p_scores integer[], p_weights integer[])
RETURNS integer
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN COALESCE(SUM(w), 0) = 0 THEN NULL
    ELSE round(SUM(s::numeric * w) / SUM(w))::int END
  FROM unnest(p_scores, p_weights) AS t(s, w)
  WHERE s IS NOT NULL AND w IS NOT NULL;
$$;

REVOKE ALL ON FUNCTION public.bs_level_overall(integer[], integer[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_level_overall(integer[], integer[]) TO authenticated, service_role;

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
  IF NOT public.bs_is_staff() THEN
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
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason required';
  END IF;
  UPDATE public.student_level_scores
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_id AND voided_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Score not found or already voided';
  END IF;
END;
$$;

-- One row per live member: section scores, overall, coverage, and the overall
-- as it stood before the latest assessment date (for the trend arrow).
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
  IF NOT public.bs_is_staff() THEN
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

REVOKE ALL ON FUNCTION public.staff_save_level_scores(uuid, uuid, date, jsonb, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_void_level_score(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_level_board(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_save_level_scores(uuid, uuid, date, jsonb, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_void_level_score(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_level_board(uuid) TO authenticated;

-- Results -----------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.lesson_results (
  lesson_id uuid NOT NULL REFERENCES public.class_lessons(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  m1 smallint CHECK (m1 BETWEEN 0 AND 27),
  m2 smallint CHECK (m2 BETWEEN 0 AND 27),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (lesson_id, user_id),
  CONSTRAINT lesson_results_not_empty CHECK (m1 IS NOT NULL OR m2 IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS lesson_results_group_idx ON public.lesson_results (group_id, user_id);

ALTER TABLE public.lesson_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "results read own or staff" ON public.lesson_results;
CREATE POLICY "results read own or staff" ON public.lesson_results
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

GRANT SELECT ON public.lesson_results TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.lesson_results FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.lesson_results TO service_role;

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
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF (p_m1 IS NOT NULL AND (p_m1 < 0 OR p_m1 > 27)) OR (p_m2 IS NOT NULL AND (p_m2 < 0 OR p_m2 > 27)) THEN
    RAISE EXCEPTION 'M1 and M2 must be whole numbers from 0 to 27';
  END IF;
  SELECT group_id INTO v_group FROM public.class_lessons WHERE id = p_lesson_id;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Lesson not found';
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

REVOKE ALL ON FUNCTION public.staff_set_result(uuid, uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_result(uuid, uuid, integer, integer) TO authenticated;
