-- Lessons CMS. Do not reuse lesson_attendance (class heatmaps).

CREATE TABLE public.lesson_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  icon text NOT NULL DEFAULT 'book-open',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lesson_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id uuid NOT NULL REFERENCES public.lesson_subjects(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.lesson_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  body text NOT NULL DEFAULT '',
  video_url text,
  video_path text,
  duration_seconds integer,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

CREATE INDEX lesson_topics_subject_id_idx ON public.lesson_topics (subject_id, sort_order);
CREATE INDEX lessons_topic_id_idx ON public.lessons (topic_id, sort_order);
CREATE INDEX lesson_progress_user_id_idx ON public.lesson_progress (user_id);

CREATE TRIGGER lesson_subjects_set_updated_at
  BEFORE UPDATE ON public.lesson_subjects
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER lesson_topics_set_updated_at
  BEFORE UPDATE ON public.lesson_topics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER lessons_set_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lesson_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read lesson subjects"
  ON public.lesson_subjects FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff write lesson subjects"
  ON public.lesson_subjects FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "Authenticated read lesson topics"
  ON public.lesson_topics FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Staff write lesson topics"
  ON public.lesson_topics FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "Read published or staff lessons"
  ON public.lessons FOR SELECT TO authenticated
  USING (published OR public.bs_is_staff());

CREATE POLICY "Staff write lessons"
  ON public.lessons FOR INSERT TO authenticated
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "Staff update lessons"
  ON public.lessons FOR UPDATE TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "Staff delete lessons"
  ON public.lessons FOR DELETE TO authenticated
  USING (public.bs_is_staff());

CREATE POLICY "Own lesson progress"
  ON public.lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

CREATE POLICY "Students insert own lesson progress"
  ON public.lesson_progress FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Students update own lesson progress"
  ON public.lesson_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT ON public.lesson_subjects, public.lesson_topics, public.lessons, public.lesson_progress TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_subjects, public.lesson_topics, public.lessons TO authenticated;
GRANT INSERT, UPDATE ON public.lesson_progress TO authenticated;
GRANT ALL ON public.lesson_subjects, public.lesson_topics, public.lessons, public.lesson_progress TO service_role;

INSERT INTO public.lesson_subjects (slug, title, sort_order, icon)
VALUES
  ('reading-writing', 'Reading & Writing', 0, 'book-open'),
  ('math', 'Math', 1, 'calculator');

INSERT INTO public.lesson_topics (subject_id, title, sort_order, description)
SELECT s.id, t.title, t.sort_order, t.description
FROM public.lesson_subjects s
JOIN (
  VALUES
    ('reading-writing', 'Grammar Rules', 0, 'Standard English Conventions: agreement, punctuation, and modifiers.'),
    ('reading-writing', 'Transitions', 1, 'Choose the transition that best connects two ideas.'),
    ('reading-writing', 'Rhetorical Synthesis', 2, 'Combine notes into a sentence that hits a stated goal.'),
    ('math', 'Heart of Algebra', 0, 'Linear equations, inequalities, and systems.'),
    ('math', 'Advanced Math', 1, 'Quadratics, exponentials, and equivalent expressions.'),
    ('math', 'Problem Solving & Data Analysis', 2, 'Ratios, percentages, scatterplots, and probability.')
) AS t(slug, title, sort_order, description)
  ON s.slug = t.slug;

INSERT INTO storage.buckets (id, name, public)
VALUES ('lesson-uploads', 'lesson-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "lesson uploads read auth" ON storage.objects;
CREATE POLICY "lesson uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'lesson-uploads');

DROP POLICY IF EXISTS "lesson uploads write staff" ON storage.objects;
CREATE POLICY "lesson uploads write staff" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'lesson-uploads' AND public.bs_is_staff());

DROP POLICY IF EXISTS "lesson uploads update staff" ON storage.objects;
CREATE POLICY "lesson uploads update staff" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'lesson-uploads' AND public.bs_is_staff())
  WITH CHECK (bucket_id = 'lesson-uploads' AND public.bs_is_staff());

DROP POLICY IF EXISTS "lesson uploads delete staff" ON storage.objects;
CREATE POLICY "lesson uploads delete staff" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'lesson-uploads' AND public.bs_is_staff());
