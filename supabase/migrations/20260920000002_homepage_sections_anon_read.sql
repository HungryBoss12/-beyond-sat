-- Fix landing-page hang: anon visitors hit
--   homepage_sections SELECT policy
--     USING (visible OR private.has_role(...))
-- but anon has no EXECUTE on private.has_role (revoked in the role-oracle
-- clamp). Postgres evaluates the whole expression and 401s the query, so the
-- marketing homepage stays on SectionSkeleton forever.
--
-- Split the read policy so the public path never references has_role.

DROP POLICY IF EXISTS "Anyone can read visible homepage sections"
  ON public.homepage_sections;

CREATE POLICY "Anyone can read visible homepage sections"
  ON public.homepage_sections
  FOR SELECT
  TO anon, authenticated
  USING (visible = true);

CREATE POLICY "Admins can read all homepage sections"
  ON public.homepage_sections
  FOR SELECT
  TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));
