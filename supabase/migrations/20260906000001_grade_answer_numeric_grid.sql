-- Accept equivalent grid-in answers (.3 = 0.3, 18/17 ≈ 1.0588) while keeping
-- exact string match first so listed fractions like 3/10 still match.

CREATE OR REPLACE FUNCTION public.bs_parse_grid_number(p_raw text)
RETURNS double precision
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  slash int;
  left_part text;
  right_part text;
  n double precision;
  d double precision;
BEGIN
  IF p_raw IS NULL THEN
    RETURN NULL;
  END IF;
  t := replace(btrim(p_raw), ',', '');
  IF t = '' THEN
    RETURN NULL;
  END IF;
  slash := position('/' in t);
  IF slash > 0 THEN
    left_part := btrim(substring(t from 1 for slash - 1));
    right_part := btrim(substring(t from slash + 1));
    IF left_part ~ '^-?[0-9]*\.?[0-9]+$' AND right_part ~ '^-?[0-9]*\.?[0-9]+$' THEN
      n := left_part::double precision;
      d := right_part::double precision;
      IF d = 0 THEN
        RETURN NULL;
      END IF;
      RETURN n / d;
    END IF;
    RETURN NULL;
  END IF;
  IF t ~ '^-?[0-9]*\.?[0-9]+$' THEN
    RETURN t::double precision;
  END IF;
  RETURN NULL;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$;

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
         OR (
           public.bs_parse_grid_number(v) IS NOT NULL
           AND public.bs_parse_grid_number(p_grid_answer) IS NOT NULL
           AND abs(public.bs_parse_grid_number(v) - public.bs_parse_grid_number(p_grid_answer)) < 1e-4
         )
    );
  ELSE
    IF p_choice_id IS NULL THEN RETURN NULL; END IF;
    RETURN p_choice_id = q.correct_choice_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.grade_answer(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.grade_answer(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_parse_grid_number(text) TO authenticated;
