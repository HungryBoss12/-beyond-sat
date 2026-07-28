
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
