-- SAT skill topics + curated YouTube recommendations.
-- Safe to run after 20260913000001 even if seed topics already exist.

CREATE TABLE IF NOT EXISTS public.lesson_recommended_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid NOT NULL REFERENCES public.lesson_topics(id) ON DELETE CASCADE,
  title text NOT NULL,
  youtube_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lesson_recommended_videos_topic_id_idx
  ON public.lesson_recommended_videos (topic_id, sort_order);

DROP TRIGGER IF EXISTS lesson_recommended_videos_set_updated_at ON public.lesson_recommended_videos;
CREATE TRIGGER lesson_recommended_videos_set_updated_at
  BEFORE UPDATE ON public.lesson_recommended_videos
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.lesson_recommended_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read lesson recommended videos" ON public.lesson_recommended_videos;
CREATE POLICY "Authenticated read lesson recommended videos"
  ON public.lesson_recommended_videos FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Staff write lesson recommended videos" ON public.lesson_recommended_videos;
CREATE POLICY "Staff write lesson recommended videos"
  ON public.lesson_recommended_videos FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT ON public.lesson_recommended_videos TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.lesson_recommended_videos TO authenticated;
GRANT ALL ON public.lesson_recommended_videos TO service_role;

-- Drop unused seed topics that have no lessons yet, then insert SAT skills.
DELETE FROM public.lesson_topics t
WHERE NOT EXISTS (SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id)
  AND t.title IN (
    'Grammar Rules',
    'Transitions',
    'Rhetorical Synthesis',
    'Heart of Algebra',
    'Advanced Math',
    'Problem Solving & Data Analysis'
  );

INSERT INTO public.lesson_topics (subject_id, title, sort_order, description)
SELECT s.id, v.title, v.sort_order, v.description
FROM public.lesson_subjects s
JOIN (
  VALUES
    ('reading-writing', 'Craft and Structure', 0, 'Words in context, text structure, and purpose.'),
    ('reading-writing', 'Information and Ideas', 1, 'Central ideas, details, and command of evidence.'),
    ('reading-writing', 'Standard English Conventions', 2, 'Form, structure, and sense — grammar and punctuation.'),
    ('reading-writing', 'Expression of Ideas', 3, 'Rhetorical synthesis and transitions.'),
    ('math', 'Algebra', 0, 'Linear equations, inequalities, and systems.'),
    ('math', 'Advanced Math', 1, 'Quadratics, exponentials, and equivalent expressions.'),
    ('math', 'Problem-Solving and Data Analysis', 2, 'Ratios, percentages, scatterplots, and probability.'),
    ('math', 'Geometry and Trigonometry', 3, 'Area, volume, triangles, and circles.')
) AS v(slug, title, sort_order, description)
  ON s.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM public.lesson_topics t
  WHERE t.subject_id = s.id AND t.title = v.title
);
