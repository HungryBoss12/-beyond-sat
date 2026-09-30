-- Homework grades, VAR linkage, and auto-tick that never overwrites a manual mark.

DO $$ BEGIN
  CREATE TYPE public.var_kind AS ENUM ('vocab', 'assignment', 'article');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS var_kind public.var_kind,
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.class_lessons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS max_score smallint;

ALTER TABLE public.homework_assignments
  DROP CONSTRAINT IF EXISTS homework_assignments_max_score_ok;
ALTER TABLE public.homework_assignments
  ADD CONSTRAINT homework_assignments_max_score_ok
  CHECK (max_score IS NULL OR max_score > 0);

ALTER TABLE public.homework_submissions
  ADD COLUMN IF NOT EXISTS score smallint,
  ADD COLUMN IF NOT EXISTS graded_at timestamptz;

ALTER TABLE public.vocab_homework_assignments
  ADD COLUMN IF NOT EXISTS lesson_id uuid REFERENCES public.class_lessons(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.homework_submissions_score_ok()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_max smallint;
BEGIN
  IF NEW.score IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.score < 0 THEN
    RAISE EXCEPTION 'Score cannot be negative';
  END IF;
  SELECT max_score INTO v_max FROM public.homework_assignments WHERE id = NEW.assignment_id;
  IF v_max IS NOT NULL AND NEW.score > v_max THEN
    RAISE EXCEPTION 'Score cannot exceed the assignment maximum';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homework_submissions_score_ok ON public.homework_submissions;
CREATE TRIGGER homework_submissions_score_ok
  BEFORE INSERT OR UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.homework_submissions_score_ok();

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

DROP POLICY IF EXISTS "hw sub insert own" ON public.homework_submissions;
CREATE POLICY "hw sub insert own" ON public.homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('pending', 'submitted')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
    AND score IS NULL
    AND graded_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.bs_var_autotick(
  p_lesson_id uuid,
  p_user_id uuid,
  p_flag text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
BEGIN
  IF p_flag NOT IN ('vocab', 'assignment', 'article') THEN
    RETURN;
  END IF;
  SELECT class_id INTO v_class FROM public.class_lessons WHERE id = p_lesson_id;
  IF v_class IS NULL THEN
    RETURN;
  END IF;
  INSERT INTO public.lesson_var_marks (
    class_id, lesson_id, user_id,
    vocab, assignment, article,
    vocab_source, assignment_source, article_source,
    updated_at
  )
  VALUES (
    v_class, p_lesson_id, p_user_id,
    p_flag = 'vocab', p_flag = 'assignment', p_flag = 'article',
    CASE WHEN p_flag = 'vocab' THEN 'auto'::public.var_source END,
    CASE WHEN p_flag = 'assignment' THEN 'auto'::public.var_source END,
    CASE WHEN p_flag = 'article' THEN 'auto'::public.var_source END,
    now()
  )
  ON CONFLICT (lesson_id, user_id) DO UPDATE SET
    vocab = CASE
      WHEN p_flag = 'vocab' AND lesson_var_marks.vocab_source IS DISTINCT FROM 'manual' THEN true
      ELSE lesson_var_marks.vocab
    END,
    vocab_source = CASE
      WHEN p_flag = 'vocab' AND lesson_var_marks.vocab_source IS DISTINCT FROM 'manual' THEN 'auto'::public.var_source
      ELSE lesson_var_marks.vocab_source
    END,
    assignment = CASE
      WHEN p_flag = 'assignment' AND lesson_var_marks.assignment_source IS DISTINCT FROM 'manual' THEN true
      ELSE lesson_var_marks.assignment
    END,
    assignment_source = CASE
      WHEN p_flag = 'assignment' AND lesson_var_marks.assignment_source IS DISTINCT FROM 'manual' THEN 'auto'::public.var_source
      ELSE lesson_var_marks.assignment_source
    END,
    article = CASE
      WHEN p_flag = 'article' AND lesson_var_marks.article_source IS DISTINCT FROM 'manual' THEN true
      ELSE lesson_var_marks.article
    END,
    article_source = CASE
      WHEN p_flag = 'article' AND lesson_var_marks.article_source IS DISTINCT FROM 'manual' THEN 'auto'::public.var_source
      ELSE lesson_var_marks.article_source
    END,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.bs_var_autotick(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.homework_submissions_autotick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind public.var_kind;
  v_lesson uuid;
BEGIN
  IF NEW.status = 'accepted' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'accepted') THEN
    SELECT a.var_kind, a.lesson_id INTO v_kind, v_lesson
    FROM public.homework_assignments a
    WHERE a.id = NEW.assignment_id;
    IF v_kind IS NOT NULL AND v_lesson IS NOT NULL THEN
      PERFORM public.bs_var_autotick(v_lesson, NEW.student_id, v_kind::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homework_submissions_autotick ON public.homework_submissions;
CREATE TRIGGER homework_submissions_autotick
  AFTER INSERT OR UPDATE OF status ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.homework_submissions_autotick();

CREATE OR REPLACE FUNCTION public.vocab_homework_autotick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_lesson uuid;
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    SELECT a.lesson_id INTO v_lesson
    FROM public.vocab_homework_assignments a
    WHERE a.id = NEW.assignment_id AND a.lesson_id IS NOT NULL;
    IF v_lesson IS NOT NULL THEN
      PERFORM public.bs_var_autotick(v_lesson, NEW.user_id, 'vocab');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vocab_homework_autotick ON public.vocab_homework_completions;
CREATE TRIGGER vocab_homework_autotick
  AFTER INSERT OR UPDATE OF status ON public.vocab_homework_completions
  FOR EACH ROW EXECUTE FUNCTION public.vocab_homework_autotick();
