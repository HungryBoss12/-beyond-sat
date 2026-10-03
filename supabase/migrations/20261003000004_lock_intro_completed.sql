-- Students cannot skip onboarding by writing profiles.intro_completed themselves.
-- The onboarding form calls bs_complete_intro, which sets a transaction-local flag.

CREATE OR REPLACE FUNCTION public.bs_lock_profile_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  NEW.banned := OLD.banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;

  IF current_setting('beyondsat.clear_must_change', true) IS DISTINCT FROM 'on' THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  ELSIF NOT (OLD.must_change_credentials IS TRUE AND NEW.must_change_credentials IS FALSE) THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  END IF;

  IF current_setting('beyondsat.complete_intro', true) IS DISTINCT FROM 'on' THEN
    NEW.intro_completed := OLD.intro_completed;
  ELSIF NOT (OLD.intro_completed IS NOT TRUE AND NEW.intro_completed IS TRUE) THEN
    NEW.intro_completed := OLD.intro_completed;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_lock_profile_intro_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.bs_is_staff() THEN
    RETURN NEW;
  END IF;
  IF current_setting('beyondsat.complete_intro', true) IS DISTINCT FROM 'on' THEN
    NEW.intro_completed := false;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bs_profiles_lock_intro_on_insert ON public.profiles;
CREATE TRIGGER bs_profiles_lock_intro_on_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.bs_lock_profile_intro_on_insert();

CREATE OR REPLACE FUNCTION public.bs_complete_intro(
  p_exam_date date,
  p_target_rw integer,
  p_target_math integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Sign in required';
  END IF;
  IF p_exam_date IS NULL THEN
    RAISE EXCEPTION 'Please pick your exam date.';
  END IF;
  IF p_exam_date < CURRENT_DATE THEN
    RAISE EXCEPTION 'Your exam date can''t be in the past.';
  END IF;
  IF p_exam_date > (CURRENT_DATE + INTERVAL '3 years')::date THEN
    RAISE EXCEPTION 'Please pick a date within the next three years.';
  END IF;
  IF p_target_rw IS NULL OR p_target_rw < 200 OR p_target_rw > 800 THEN
    RAISE EXCEPTION 'Reading & Writing target must be between 200 and 800.';
  END IF;
  IF p_target_math IS NULL OR p_target_math < 200 OR p_target_math > 800 THEN
    RAISE EXCEPTION 'Math target must be between 200 and 800.';
  END IF;

  INSERT INTO public.student_profiles (
    user_id,
    exam_date,
    target_rw,
    target_math,
    target_score,
    step,
    intro_completed_at
  )
  VALUES (
    uid,
    p_exam_date,
    p_target_rw,
    p_target_math,
    p_target_rw + p_target_math,
    1,
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    exam_date = EXCLUDED.exam_date,
    target_rw = EXCLUDED.target_rw,
    target_math = EXCLUDED.target_math,
    target_score = EXCLUDED.target_score,
    step = GREATEST(public.student_profiles.step, 1),
    intro_completed_at = COALESCE(public.student_profiles.intro_completed_at, now());

  PERFORM set_config('beyondsat.complete_intro', 'on', true);

  UPDATE public.profiles
  SET intro_completed = true
  WHERE id = uid;

  IF NOT FOUND THEN
    INSERT INTO public.profiles (id, intro_completed)
    VALUES (uid, true);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_complete_intro(date, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_complete_intro(date, integer, integer) TO authenticated;

-- A teacher of the assignment's group can save a review. A student still cannot.
CREATE OR REPLACE FUNCTION public.homework_submissions_protect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.bs_is_staff() THEN
    RETURN NEW;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.homework_assignments a
    WHERE a.id = NEW.assignment_id
      AND public.bs_teaches_group(a.group_id)
  ) THEN
    RETURN NEW;
  END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
    RAISE EXCEPTION 'Cannot reassign a homework submission';
  END IF;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.review_note := OLD.review_note;
  NEW.score := OLD.score;
  NEW.graded_at := OLD.graded_at;
  IF OLD.status IN ('accepted', 'reviewed') THEN
    NEW.status := OLD.status;
  ELSE
    NEW.status := 'submitted';
  END IF;
  RETURN NEW;
END;
$$;
