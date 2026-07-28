
-- Enums
CREATE TYPE public.sat_section AS ENUM ('reading_writing', 'math');
CREATE TYPE public.sat_difficulty AS ENUM ('easy', 'medium', 'hard');
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
