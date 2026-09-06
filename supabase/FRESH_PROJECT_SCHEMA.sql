-- =====================================================================
-- BeyondSAT - complete schema for a FRESH Supabase project.
--
-- Generated from supabase/migrations/ by buildschema.cjs. Run this as ONE
-- execution in the Supabase SQL editor. Three deliberate differences from a
-- naive replay of the migration folder, each one required:
--
--   1. 20260718183907 and 20260718183930 are omitted. 183907 creates
--      public.profiles, trigger on_auth_user_created and trigger
--      profiles_set_updated_at - all three of which 20260718230822 creates
--      again, with more columns. Nothing drops them in between, so replaying
--      both fails with 'relation "public.profiles" already exists'. The two
--      REVOKEs from 183930 are preserved at the bottom of this file.
--
--   2. Every 'ALTER TYPE ... ADD VALUE' is folded into its CREATE TYPE.
--      Postgres refuses to use a new enum label in the same transaction that
--      added it, and the SQL editor runs one transaction per execution.
--      Declaring the labels up front removes that constraint - which is why
--      'editor' is present in app_role from the start here, and the old
--      two-step step1/step2 run is not needed on a fresh project.
--
--   3. Ordering otherwise follows migration filenames, unchanged.
--
-- ONE MANUAL STEP AFTERWARDS: create the 'question-images' storage bucket.
-- No migration creates it (only its RLS policies), so add it by hand under
-- Storage -> New bucket, with Public left unchecked.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 20260718230822_64ec35fd-78cd-4b94-956b-ee61805358ee.sql
-- ---------------------------------------------------------------------
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('student', 'admin', 'editor');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  city TEXT,
  school TEXT,
  grade INT,
  birth_date DATE,
  intro_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- Profiles policies
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "Admins view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- user_roles policies
CREATE POLICY "Users view own role" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins view all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- student_profiles
CREATE TABLE public.student_profiles (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  target_score INT,
  exam_date DATE,
  time_bucket TEXT,
  fears TEXT[] NOT NULL DEFAULT '{}',
  fear_other TEXT,
  level TEXT,
  step INT NOT NULL DEFAULT 0,
  intro_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_profiles TO authenticated;
GRANT ALL ON public.student_profiles TO service_role;
ALTER TABLE public.student_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own student profile" ON public.student_profiles
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins view student profiles" ON public.student_profiles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- updated_at trigger fn
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER student_profiles_set_updated_at BEFORE UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile + assign student role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta jsonb := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  first_name text;
  last_name text;
  display_name text;
  parts text[];
BEGIN
  first_name := NULLIF(btrim(meta->>'first_name'), '');
  last_name := NULLIF(btrim(meta->>'last_name'), '');

  IF first_name IS NULL THEN
    first_name := NULLIF(btrim(meta->>'given_name'), '');
  END IF;
  IF last_name IS NULL THEN
    last_name := NULLIF(btrim(meta->>'family_name'), '');
  END IF;

  display_name := NULLIF(btrim(COALESCE(meta->>'full_name', meta->>'name')), '');

  IF (first_name IS NULL OR last_name IS NULL) AND display_name IS NOT NULL THEN
    parts := regexp_split_to_array(display_name, '\s+');
    IF first_name IS NULL AND array_length(parts, 1) >= 1 THEN
      first_name := parts[1];
    END IF;
    IF last_name IS NULL AND array_length(parts, 1) >= 2 THEN
      last_name := array_to_string(parts[2:array_length(parts, 1)], ' ');
    END IF;
  END IF;

  IF display_name IS NULL THEN
    display_name := NULLIF(btrim(CONCAT(COALESCE(first_name, ''), ' ', COALESCE(last_name, ''))), '');
  END IF;

  INSERT INTO public.profiles (id, email, first_name, last_name, city, school, grade, birth_date, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    first_name,
    last_name,
    NULLIF(btrim(meta->>'city'), ''),
    NULLIF(btrim(meta->>'school'), ''),
    NULLIF(meta->>'grade', '')::INT,
    NULLIF(meta->>'birth_date', '')::DATE,
    display_name
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'student')
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 20260718230846_f5fabbad-84a5-4b28-a1cd-466a42349869.sql
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- ---------------------------------------------------------------------
-- 20260718232521_b1b06282-e570-4e7f-b682-b1cf22326d09.sql
-- ---------------------------------------------------------------------
-- Enums
CREATE TYPE public.sat_section AS ENUM ('reading_writing', 'math');
CREATE TYPE public.sat_difficulty AS ENUM ('easy', 'medium', 'hard', 'C', 'B', 'D', 'A', 'S');
CREATE TYPE public.test_type AS ENUM ('practice', 'daily', 'mock');
CREATE TYPE public.question_kind AS ENUM ('multiple_choice', 'grid_in');

-- Streak fields on student_profiles
ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS current_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS longest_streak INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_daily_completed_date DATE;

-- Questions
CREATE TABLE public.questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section public.sat_section NOT NULL,
  skill TEXT NOT NULL,
  difficulty public.sat_difficulty NOT NULL,
  kind public.question_kind NOT NULL DEFAULT 'multiple_choice',
  prompt TEXT,
  question_text TEXT NOT NULL,
  choices JSONB NOT NULL DEFAULT '[]'::jsonb,
  correct_choice_id TEXT,
  correct_grid_answers TEXT[],
  explanation TEXT,
  image_url TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.questions TO authenticated;
GRANT ALL ON public.questions TO service_role;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read questions" ON public.questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins insert questions" ON public.questions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins update questions" ON public.questions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins delete questions" ON public.questions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_questions_updated_at BEFORE UPDATE ON public.questions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_questions_section ON public.questions(section);
CREATE INDEX idx_questions_skill ON public.questions(skill);
CREATE INDEX idx_questions_difficulty ON public.questions(difficulty);

-- Daily tests
CREATE TABLE public.daily_tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  title TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.daily_tests TO authenticated;
GRANT ALL ON public.daily_tests TO service_role;
ALTER TABLE public.daily_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read daily_tests" ON public.daily_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage daily_tests" ON public.daily_tests FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_daily_tests_updated_at BEFORE UPDATE ON public.daily_tests FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.daily_test_questions (
  daily_test_id UUID NOT NULL REFERENCES public.daily_tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (daily_test_id, question_id)
);
GRANT SELECT ON public.daily_test_questions TO authenticated;
GRANT ALL ON public.daily_test_questions TO service_role;
ALTER TABLE public.daily_test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read daily_test_questions" ON public.daily_test_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage daily_test_questions" ON public.daily_test_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mock exams
CREATE TABLE public.mock_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  rw_module1_time_seconds INTEGER NOT NULL DEFAULT 1920,
  rw_module2_time_seconds INTEGER NOT NULL DEFAULT 1920,
  math_module1_time_seconds INTEGER NOT NULL DEFAULT 2100,
  math_module2_time_seconds INTEGER NOT NULL DEFAULT 2100,
  rw_module1_threshold INTEGER NOT NULL DEFAULT 15,
  math_module1_threshold INTEGER NOT NULL DEFAULT 12,
  published BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.mock_exams TO authenticated;
GRANT ALL ON public.mock_exams TO service_role;
ALTER TABLE public.mock_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read published mocks" ON public.mock_exams FOR SELECT TO authenticated USING (published OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage mock_exams" ON public.mock_exams FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_mock_exams_updated_at BEFORE UPDATE ON public.mock_exams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.mock_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_exam_id UUID NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE RESTRICT,
  section public.sat_section NOT NULL,
  module INTEGER NOT NULL CHECK (module IN (1, 2)),
  variant TEXT NOT NULL DEFAULT 'base' CHECK (variant IN ('base', 'easier', 'harder')),
  position INTEGER NOT NULL DEFAULT 0
);
GRANT SELECT ON public.mock_exam_questions TO authenticated;
GRANT ALL ON public.mock_exam_questions TO service_role;
ALTER TABLE public.mock_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read mock_exam_questions" ON public.mock_exam_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage mock_exam_questions" ON public.mock_exam_questions FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Test sessions
CREATE TABLE public.test_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.test_type NOT NULL,
  mock_exam_id UUID REFERENCES public.mock_exams(id) ON DELETE SET NULL,
  daily_test_id UUID REFERENCES public.daily_tests(id) ON DELETE SET NULL,
  score INTEGER,
  rw_score INTEGER,
  math_score INTEGER,
  total_questions INTEGER,
  correct_count INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_sessions TO authenticated;
GRANT ALL ON public.test_sessions TO service_role;
ALTER TABLE public.test_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own sessions" ON public.test_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own sessions" ON public.test_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.test_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own sessions" ON public.test_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER trg_test_sessions_updated_at BEFORE UPDATE ON public.test_sessions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_test_sessions_user ON public.test_sessions(user_id, completed_at DESC);

-- Attempts
CREATE TABLE public.attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.test_sessions(id) ON DELETE CASCADE,
  question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  test_type public.test_type NOT NULL,
  selected_choice_id TEXT,
  grid_answer TEXT,
  is_correct BOOLEAN,
  marked_for_review BOOLEAN NOT NULL DEFAULT false,
  eliminated_choice_ids TEXT[] NOT NULL DEFAULT '{}',
  time_spent_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attempts TO authenticated;
GRANT ALL ON public.attempts TO service_role;
ALTER TABLE public.attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own attempts" ON public.attempts FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own attempts" ON public.attempts FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own attempts" ON public.attempts FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own attempts" ON public.attempts FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_attempts_user ON public.attempts(user_id, created_at DESC);
CREATE INDEX idx_attempts_session ON public.attempts(session_id);
CREATE INDEX idx_attempts_question ON public.attempts(question_id);

-- ---------------------------------------------------------------------
-- 20260718235250_70f4641b-0db6-4d3d-a8ba-b64ab62a332e.sql
-- ---------------------------------------------------------------------
-- News articles for Phase 9
CREATE TABLE public.news_articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  excerpt TEXT,
  body TEXT NOT NULL,
  cover_image_url TEXT,
  published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.news_articles TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news_articles TO authenticated;
GRANT ALL ON public.news_articles TO service_role;

ALTER TABLE public.news_articles ENABLE ROW LEVEL SECURITY;

-- Anyone (signed in or not) can read published articles
CREATE POLICY "Public can read published articles"
  ON public.news_articles FOR SELECT
  USING (published = true);

-- Admins can read all articles (including drafts)
CREATE POLICY "Admins can read all articles"
  ON public.news_articles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert articles"
  ON public.news_articles FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update articles"
  ON public.news_articles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete articles"
  ON public.news_articles FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER news_articles_set_updated_at
  BEFORE UPDATE ON public.news_articles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Admin write policies for content tables (Phase 10)
-- Questions
CREATE POLICY "Admins can insert questions"
  ON public.questions FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update questions"
  ON public.questions FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete questions"
  ON public.questions FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Daily tests
CREATE POLICY "Admins can insert daily_tests"
  ON public.daily_tests FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update daily_tests"
  ON public.daily_tests FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete daily_tests"
  ON public.daily_tests FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage daily_test_questions"
  ON public.daily_test_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Mock exams
CREATE POLICY "Admins can insert mock_exams"
  ON public.mock_exams FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update mock_exams"
  ON public.mock_exams FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete mock_exams"
  ON public.mock_exams FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage mock_exam_questions"
  ON public.mock_exam_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can read all profiles / user_roles for user management
CREATE POLICY "Admins can read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user_roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX news_articles_published_idx ON public.news_articles(published, published_at DESC);

-- ---------------------------------------------------------------------
-- 20260719013712_28e1a635-5668-4bfc-8b51-d09ba8da340d.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS source_month INT,
  ADD COLUMN IF NOT EXISTS source_year INT;

-- ---------------------------------------------------------------------
-- 20260719013743_f9aab3de-420c-453d-8a76-f0ea41901c67.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  section public.sat_section NOT NULL,
  module INT NOT NULL CHECK (module IN (1,2)),
  difficulty public.sat_difficulty NOT NULL DEFAULT 'C',
  source_month INT,
  source_year INT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.tests TO authenticated;
GRANT ALL ON public.tests TO service_role;
ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tests read auth" ON public.tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "tests admin all" ON public.tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER tests_updated_at BEFORE UPDATE ON public.tests
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.test_questions (
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  position INT NOT NULL,
  PRIMARY KEY (test_id, question_id)
);
GRANT SELECT ON public.test_questions TO authenticated;
GRANT ALL ON public.test_questions TO service_role;
ALTER TABLE public.test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tq read auth" ON public.test_questions FOR SELECT TO authenticated USING (true);
CREATE POLICY "tq admin all" ON public.test_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.daily_test_tests (
  daily_test_id UUID NOT NULL REFERENCES public.daily_tests(id) ON DELETE CASCADE,
  test_id UUID NOT NULL REFERENCES public.tests(id) ON DELETE CASCADE,
  position INT NOT NULL,
  PRIMARY KEY (daily_test_id, test_id)
);
GRANT SELECT ON public.daily_test_tests TO authenticated;
GRANT ALL ON public.daily_test_tests TO service_role;
ALTER TABLE public.daily_test_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "dtt read auth" ON public.daily_test_tests FOR SELECT TO authenticated USING (true);
CREATE POLICY "dtt admin all" ON public.daily_test_tests FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.mock_exam_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mock_exam_id UUID NOT NULL REFERENCES public.mock_exams(id) ON DELETE CASCADE,
  module INT NOT NULL CHECK (module IN (1,2)),
  section_index INT NOT NULL CHECK (section_index BETWEEN 1 AND 4),
  section_name TEXT NOT NULL,
  test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
  UNIQUE (mock_exam_id, module, section_index)
);
GRANT SELECT ON public.mock_exam_sections TO authenticated;
GRANT ALL ON public.mock_exam_sections TO service_role;
ALTER TABLE public.mock_exam_sections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mes read auth" ON public.mock_exam_sections FOR SELECT TO authenticated USING (true);
CREATE POLICY "mes admin all" ON public.mock_exam_sections FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ---------------------------------------------------------------------
-- 20260719013813_fb5b704a-966a-4f88-a5ab-b9964374d308.sql
-- ---------------------------------------------------------------------
CREATE POLICY "qimg read auth" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'question-images');
CREATE POLICY "qimg admin write" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "qimg admin update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "qimg admin delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'question-images' AND public.has_role(auth.uid(),'admin'));

-- ---------------------------------------------------------------------
-- 20260719024826_c6da4008-9480-4a89-a415-65c12b37164e.sql
-- ---------------------------------------------------------------------
CREATE TABLE public.homepage_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  position int NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT true,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.homepage_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homepage_sections TO authenticated;
GRANT ALL ON public.homepage_sections TO service_role;

ALTER TABLE public.homepage_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read visible homepage sections"
  ON public.homepage_sections FOR SELECT
  USING (visible = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert homepage sections"
  ON public.homepage_sections FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update homepage sections"
  ON public.homepage_sections FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete homepage sections"
  ON public.homepage_sections FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER homepage_sections_set_updated_at
  BEFORE UPDATE ON public.homepage_sections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.homepage_sections (kind, position, data) VALUES
('hero', 10, '{
  "title": "Master the Digital SAT.",
  "subtitle": "Practice like it''s test day. Track your progress. Reach your goal score.",
  "primary_cta_label": "Start Practicing",
  "primary_cta_href": "/signup",
  "secondary_cta_label": "Sign In",
  "secondary_cta_href": "/signin"
}'::jsonb),
('stats', 20, '{
  "items": [
    {"n": 94, "s": "%", "l": "of students reached their goal score after our courses"},
    {"n": 80, "s": "%", "l": "of students improved by 100+ points using the app"},
    {"n": 1500, "s": "+", "l": "practice questions in Reading & Writing and Math"},
    {"n": 100, "s": "%", "l": "true test-day testing experience"}
  ]
}'::jsonb),
('features', 30, '{
  "title": "Everything you need to prepare.",
  "subtitle": "Purpose-built for the Digital SAT.",
  "items": [
    {"icon": "GraduationCap", "title": "Realistic Mock Exams", "description": "Full-length, timed, scored out of 1600 just like the real SAT."},
    {"icon": "Layout", "title": "True Test-Day Interface", "description": "A split-screen practice experience that mirrors the real digital SAT, with the same on-screen tools you''ll use on test day."},
    {"icon": "TrendingUp", "title": "Track Your Progress", "description": "Watch your score climb, review every mistake, focus on weak areas."}
  ]
}'::jsonb),
('how', 40, '{
  "title": "How it works",
  "items": [
    {"n": "1", "title": "Sign up", "description": "Create your free BeyondSAT account in seconds."},
    {"n": "2", "title": "Practice & take mocks", "description": "Work through the question bank and take full-length tests."},
    {"n": "3", "title": "Improve your score", "description": "Review mistakes, track trends, and hit your goal."}
  ]
}'::jsonb),
('cta', 50, '{
  "title": "Ready to raise your SAT score?",
  "button_label": "Sign Up Free",
  "button_href": "/signup"
}'::jsonb);

-- ---------------------------------------------------------------------
-- 20260719130535_3e61d375-a862-4bdc-ab95-1b71573bc19b.sql
-- ---------------------------------------------------------------------
GRANT SELECT ON public.homepage_sections TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homepage_sections TO authenticated;
GRANT ALL ON public.homepage_sections TO service_role;

-- ---------------------------------------------------------------------
-- 20260719130857_ab054135-aac3-4eae-a0ad-82c11bb14309.sql
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- 20260719131502_70ee2354-1892-4a31-b6c2-8499c89da107.sql
-- ---------------------------------------------------------------------
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO anon, authenticated;

-- ---------------------------------------------------------------------
-- 20260719152104_64e3d7bb-2218-4a9e-8ef0-3280ad5a1fe9.sql
-- ---------------------------------------------------------------------
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS time_limit_seconds integer;
ALTER TABLE public.tests ADD COLUMN IF NOT EXISTS time_limit_seconds integer;

-- ---------------------------------------------------------------------
-- 20260721212644_ac90a639-3aa6-4eb2-ae07-e966b4f9589f.sql
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.app_settings TO anon, authenticated;
GRANT ALL ON public.app_settings TO service_role;
GRANT INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Admins can insert settings" ON public.app_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update settings" ON public.app_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete settings" ON public.app_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER app_settings_set_updated_at BEFORE UPDATE ON public.app_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.app_settings (key, value) VALUES ('desmos_api_key', '') ON CONFLICT (key) DO NOTHING;

-- ---------------------------------------------------------------------
-- 20260721232119_cf049b80-383a-4577-9484-5b4b94004f71.sql
-- ---------------------------------------------------------------------
-- 1) Move has_role to private schema (removes anon/authenticated executable SECURITY DEFINER in public API)
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO anon, authenticated, service_role;

ALTER FUNCTION public.has_role(uuid, app_role) SET SCHEMA private;

-- Ensure execute grants remain for policy usage (policies follow the function OID across schema move)
REVOKE ALL ON FUNCTION private.has_role(uuid, app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, app_role) TO anon, authenticated, service_role;

-- 2) Lock down app_settings and expose only the Desmos key via a safe function
DROP POLICY IF EXISTS "Anyone can read settings" ON public.app_settings;

CREATE POLICY "Admins can read settings"
  ON public.app_settings FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.get_desmos_api_key()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT value FROM public.app_settings WHERE key = 'desmos_api_key';
$$;

REVOKE ALL ON FUNCTION public.get_desmos_api_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_desmos_api_key() TO authenticated;

-- 3) Hide answer key on questions from regular authenticated users using column-level grants.
--    (Admins are also authenticated; they use SECURITY DEFINER RPCs below to read/write answers.)
REVOKE SELECT ON public.questions FROM authenticated;
GRANT SELECT (
  id, section, skill, difficulty, kind, prompt, question_text, choices,
  image_url, created_by, created_at, updated_at, source_month, source_year,
  time_limit_seconds
) ON public.questions TO authenticated;
-- Admin write/update/delete still governed by RLS policies
GRANT INSERT, UPDATE, DELETE ON public.questions TO authenticated;

-- Grading RPC used by the test player
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

-- Review answers: only for questions the caller has already answered in a completed session
CREATE OR REPLACE FUNCTION public.get_answers_for_review(p_question_ids uuid[])
RETURNS TABLE(
  question_id uuid,
  correct_choice_id text,
  correct_grid_answers text[],
  explanation text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT q.id, q.correct_choice_id, q.correct_grid_answers, q.explanation
    FROM public.questions q
   WHERE q.id = ANY(p_question_ids)
     AND EXISTS (
       SELECT 1
         FROM public.attempts a
         JOIN public.test_sessions s ON s.id = a.session_id
        WHERE a.question_id = q.id
          AND a.user_id = auth.uid()
          AND s.user_id = auth.uid()
          AND s.completed_at IS NOT NULL
     );
$$;

REVOKE ALL ON FUNCTION public.get_answers_for_review(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_answers_for_review(uuid[]) TO authenticated;

-- Admin RPC to fetch answer key for editing
CREATE OR REPLACE FUNCTION public.admin_get_question_answers(p_question_id uuid)
RETURNS TABLE(
  correct_choice_id text,
  correct_grid_answers text[],
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT private.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  RETURN QUERY
    SELECT q.correct_choice_id, q.correct_grid_answers, q.explanation
      FROM public.questions q
     WHERE q.id = p_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_question_answers(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_question_answers(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- 20260722204258_444b638c-bbd4-4416-99eb-9986d9251819.sql
-- ---------------------------------------------------------------------
CREATE TABLE public.exam_dates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_date DATE NOT NULL UNIQUE,
  label TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.exam_dates TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.exam_dates TO authenticated;
GRANT ALL ON public.exam_dates TO service_role;

ALTER TABLE public.exam_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active exam dates"
  ON public.exam_dates FOR SELECT
  USING (active = true OR private.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage exam dates"
  ON public.exam_dates FOR ALL
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER exam_dates_set_updated_at
  BEFORE UPDATE ON public.exam_dates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed rows. Not part of any migration: added because onboarding asks every new
-- user to pick an exam date, and only an admin can create them. On an empty
-- table that is a lockout — every authenticated route redirects to /onboarding
-- until it is finished, so the first admin could never reach Admin -> Exam Dates
-- to add the dates onboarding was waiting for.
-- These are the usual Saturday slots, not scraped from collegeboard.org.
-- Confirm them in Admin -> Exam Dates and correct anything that has moved.
INSERT INTO public.exam_dates (exam_date, label, active) VALUES
  ('2026-08-29', 'August 2026', true),
  ('2026-09-12', 'September 2026', true),
  ('2026-10-03', 'October 2026', true),
  ('2026-11-07', 'November 2026', true),
  ('2026-12-05', 'December 2026', true),
  ('2027-03-13', 'March 2027', true),
  ('2027-05-01', 'May 2027', true),
  ('2027-06-05', 'June 2027', true)
ON CONFLICT (exam_date) DO NOTHING;

ALTER TABLE public.student_profiles
  ADD COLUMN target_rw INTEGER,
  ADD COLUMN target_math INTEGER;

-- Backfill: split existing target_score evenly if present
UPDATE public.student_profiles
   SET target_rw = GREATEST(200, LEAST(800, ROUND(target_score / 2.0)::int)),
       target_math = GREATEST(200, LEAST(800, target_score - ROUND(target_score / 2.0)::int))
 WHERE target_score IS NOT NULL AND target_rw IS NULL AND target_math IS NULL;

-- Keep target_score = target_rw + target_math automatically
CREATE OR REPLACE FUNCTION public.sync_target_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.target_rw IS NOT NULL AND NEW.target_math IS NOT NULL THEN
    NEW.target_score := NEW.target_rw + NEW.target_math;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_profiles_sync_target
  BEFORE INSERT OR UPDATE ON public.student_profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_target_score();

-- ---------------------------------------------------------------------
-- 20260801000002_editor_role_presence_bans_step2.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- STEP 2 of 2 — editor role permissions, online presence, and user bans.
-- Run this only after step 1 has finished successfully.
--
-- Everything here is idempotent: re-running it is safe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. New profile columns
-- ---------------------------------------------------------------------
alter table public.profiles
  add column if not exists banned        boolean not null default false,
  add column if not exists banned_at     timestamptz,
  add column if not exists banned_reason text,
  add column if not exists last_seen_at  timestamptz;

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);


-- ---------------------------------------------------------------------
-- 2. Role helpers
--    security definer so they can read user_roles no matter what RLS the
--    caller is subject to. Prefixed bs_ so they can't collide with
--    anything the project already defines.
-- ---------------------------------------------------------------------
create or replace function public.bs_is_admin(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = _uid and r.role = 'admin'
  );
$$;

create or replace function public.bs_is_editor(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r where r.user_id = _uid and r.role = 'editor'
  );
$$;

create or replace function public.bs_is_staff(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.user_roles r
    where r.user_id = _uid and r.role in ('admin', 'editor')
  );
$$;

create or replace function public.bs_is_banned(_uid uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select p.banned from public.profiles p where p.id = _uid), false);
$$;

grant execute on function public.bs_is_admin(uuid)  to authenticated;
grant execute on function public.bs_is_editor(uuid) to authenticated;
grant execute on function public.bs_is_staff(uuid)  to authenticated;
grant execute on function public.bs_is_banned(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 3. Presence heartbeat
--    The app calls this about once a minute while a tab is visible; the
--    admin list treats anyone seen in the last 3 minutes as online.
-- ---------------------------------------------------------------------
create or replace function public.touch_presence()
returns void language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid();
$$;

grant execute on function public.touch_presence() to authenticated;


-- ---------------------------------------------------------------------
-- 4. Admin-only mutations
--    These are the server-side half of "editors can't promote or delete
--    admins" and "only admins can ban". Hiding the buttons is not enough.
-- ---------------------------------------------------------------------
create or replace function public.admin_set_role(p_user_id uuid, p_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.bs_is_admin() then
    raise exception 'Only admins can change roles';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot change your own role';
  end if;
  if p_role not in ('student', 'editor', 'admin') then
    raise exception 'Unknown role: %', p_role;
  end if;

  delete from public.user_roles
   where user_id = p_user_id and role in ('admin', 'editor');

  if p_role <> 'student' then
    insert into public.user_roles (user_id, role)
    values (p_user_id, p_role::public.app_role)
    on conflict do nothing;
  end if;
end;
$$;

create or replace function public.admin_set_banned(
  p_user_id uuid,
  p_banned  boolean,
  p_reason  text default null
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.bs_is_admin() then
    raise exception 'Only admins can ban or unban users';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'You cannot ban yourself';
  end if;

  update public.profiles
     set banned        = p_banned,
         banned_at     = case when p_banned then now() else null end,
         banned_reason = case when p_banned then p_reason else null end
   where id = p_user_id;
end;
$$;

grant execute on function public.admin_set_role(uuid, text)            to authenticated;
grant execute on function public.admin_set_banned(uuid, boolean, text) to authenticated;


-- ---------------------------------------------------------------------
-- 5. Editors need write access to their four sections
--    Existing policies grant admins everything; these add editors on top
--    for content only. Named distinctly so they never clash with yours.
-- ---------------------------------------------------------------------
drop policy if exists "editors manage questions" on public.questions;
create policy "editors manage questions" on public.questions
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage daily tests" on public.daily_tests;
create policy "editors manage daily tests" on public.daily_tests
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exams" on public.mock_exams;
create policy "editors manage mock exams" on public.mock_exams
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exam sections" on public.mock_exam_sections;
create policy "editors manage mock exam sections" on public.mock_exam_sections
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage mock exam questions" on public.mock_exam_questions;
create policy "editors manage mock exam questions" on public.mock_exam_questions
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

drop policy if exists "editors manage news" on public.news_articles;
create policy "editors manage news" on public.news_articles
  for all to authenticated
  using (public.bs_is_editor()) with check (public.bs_is_editor());

-- The mock-exam editor picks from the pool of tests, so editors need to
-- read tests — but not create or change them (Tests stays admin-only).
drop policy if exists "editors read tests" on public.tests;
create policy "editors read tests" on public.tests
  for select to authenticated using (public.bs_is_editor());

drop policy if exists "editors read test questions" on public.test_questions;
create policy "editors read test questions" on public.test_questions
  for select to authenticated using (public.bs_is_editor());


-- ---------------------------------------------------------------------
-- 6. A banned user is locked out at the data layer, not just the UI.
--    `as restrictive` ANDs with your existing policies instead of
--    replacing them, so nothing else has to be touched.
-- ---------------------------------------------------------------------
drop policy if exists "banned users blocked" on public.test_sessions;
create policy "banned users blocked" on public.test_sessions
  as restrictive for all to authenticated
  using (not public.bs_is_banned()) with check (not public.bs_is_banned());

drop policy if exists "banned users blocked" on public.attempts;
create policy "banned users blocked" on public.attempts
  as restrictive for all to authenticated
  using (not public.bs_is_banned()) with check (not public.bs_is_banned());


-- ---------------------------------------------------------------------
-- 7. Optional: grant the first editor by email.
--    Uncomment, set the address, run.
-- ---------------------------------------------------------------------
-- insert into public.user_roles (user_id, role)
-- select p.id, 'editor'::public.app_role
--   from public.profiles p
--  where p.email = 'someone@example.com'
-- on conflict do nothing;

-- ---------------------------------------------------------------------
-- carried over from 20260718183930 - keep the trigger functions off the
-- public API surface. They fire as triggers, so nothing needs EXECUTE.
-- ---------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
