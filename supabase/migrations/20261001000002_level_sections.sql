-- Level (L) sections per subject. Data, not UI strings.

CREATE TABLE IF NOT EXISTS public.level_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject public.class_subject NOT NULL,
  slug text NOT NULL CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text NOT NULL CHECK (btrim(name) <> ''),
  display_order smallint NOT NULL,
  weight smallint NOT NULL DEFAULT 1 CHECK (weight BETWEEN 1 AND 10),
  active boolean NOT NULL DEFAULT true,
  CONSTRAINT level_sections_subject_slug UNIQUE (subject, slug)
);

INSERT INTO public.level_sections (subject, slug, name, display_order) VALUES
  ('math', 'equations-inequalities', 'Equations & Inequalities', 1),
  ('math', 'systems', 'Systems', 2),
  ('math', 'linear-functions', 'Linear functions', 3),
  ('math', 'exponential-functions', 'Exponential functions', 4),
  ('math', 'quadratics', 'Quadratics', 5),
  ('math', 'modules', 'Modules', 6),
  ('math', 'functions-polynomials', 'Functions & Polynomials', 7),
  ('math', 'statistics', 'Statistics', 8),
  ('math', 'research', 'Research', 9),
  ('math', 'proportion', 'Proportion', 10),
  ('math', 'unit-conversion', 'Unit Conversion', 11),
  ('math', 'triangles', 'Triangles', 12),
  ('math', 'similarity-congruence', 'Similarity & Congruence', 13),
  ('math', 'circle', 'Circle', 14),
  ('math', 'trigonometry-unit-circle', 'Trigonometry & Unit Circle', 15),
  ('math', 'volume', 'Volume', 16),
  ('ebrw', 'words-in-context', 'Words in Context', 1),
  ('ebrw', 'text-structure-purpose', 'Text Structure and Purpose', 2),
  ('ebrw', 'cross-text-connections', 'Cross-Text Connections', 3),
  ('ebrw', 'central-ideas-details', 'Central Ideas and Details', 4),
  ('ebrw', 'command-evidence-textual', 'Command of Evidence (Textual)', 5),
  ('ebrw', 'command-evidence-quantitative', 'Command of Evidence (Quantitative)', 6),
  ('ebrw', 'inferences', 'Inferences', 7),
  ('ebrw', 'boundaries', 'Boundaries', 8),
  ('ebrw', 'form-structure-sense', 'Form, Structure, and Sense', 9),
  ('ebrw', 'transitions', 'Transitions', 10),
  ('ebrw', 'rhetorical-synthesis', 'Rhetorical Synthesis', 11)
ON CONFLICT (subject, slug) DO UPDATE
  SET name = EXCLUDED.name, display_order = EXCLUDED.display_order;

ALTER TABLE public.level_sections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "level sections read" ON public.level_sections;
CREATE POLICY "level sections read" ON public.level_sections
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "level sections admin write" ON public.level_sections;
CREATE POLICY "level sections admin write" ON public.level_sections
  FOR ALL TO authenticated
  USING (public.bs_is_admin())
  WITH CHECK (public.bs_is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.level_sections TO authenticated;
REVOKE ALL ON public.level_sections FROM anon, PUBLIC;
GRANT ALL ON public.level_sections TO service_role;
