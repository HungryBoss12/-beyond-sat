-- Same class of bug as homepage_sections: public SELECT policies of the form
--   (public_predicate OR private.has_role(...)/bs_is_staff()/bs_is_admin())
-- fail for anon because EXECUTE on those helpers was revoked. Split each into
-- a public-predicate-only policy + an authenticated staff/admin override.

-- exam_dates
DROP POLICY IF EXISTS "Anyone can view active exam dates" ON public.exam_dates;
CREATE POLICY "Anyone can view active exam dates"
  ON public.exam_dates FOR SELECT TO anon, authenticated
  USING (active = true);
CREATE POLICY "Admins can view all exam dates"
  ON public.exam_dates FOR SELECT TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::app_role));

-- classes
DROP POLICY IF EXISTS "classes read active" ON public.classes;
CREATE POLICY "classes read active"
  ON public.classes FOR SELECT TO anon, authenticated
  USING (active = true);
CREATE POLICY "classes staff read all"
  ON public.classes FOR SELECT TO authenticated
  USING (public.bs_is_staff());

-- linktree_blocks
DROP POLICY IF EXISTS "linktree blocks public read" ON public.linktree_blocks;
CREATE POLICY "linktree blocks public read"
  ON public.linktree_blocks FOR SELECT TO anon, authenticated
  USING (visible = true);
CREATE POLICY "linktree blocks admin read all"
  ON public.linktree_blocks FOR SELECT TO authenticated
  USING (public.bs_is_admin());

-- lessons (authenticated students need published; staff need drafts)
DROP POLICY IF EXISTS "Read published or staff lessons" ON public.lessons;
CREATE POLICY "Read published lessons"
  ON public.lessons FOR SELECT TO anon, authenticated
  USING (published = true);
CREATE POLICY "Staff read all lessons"
  ON public.lessons FOR SELECT TO authenticated
  USING (public.bs_is_staff());
