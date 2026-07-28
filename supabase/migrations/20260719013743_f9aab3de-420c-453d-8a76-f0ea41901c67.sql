
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
