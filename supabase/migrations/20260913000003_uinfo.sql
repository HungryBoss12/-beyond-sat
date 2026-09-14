-- Server-only student observation profile (UInfo) + tiny action changelogs.

CREATE TABLE IF NOT EXISTS public.uinfo (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.uinfo_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  k text NOT NULL,
  d text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uinfo_log_k_len CHECK (char_length(k) BETWEEN 1 AND 2),
  CONSTRAINT uinfo_log_d_len CHECK (char_length(d) <= 24)
);

CREATE INDEX IF NOT EXISTS uinfo_log_user_created_idx
  ON public.uinfo_log (user_id, created_at);

DROP TRIGGER IF EXISTS uinfo_set_updated_at ON public.uinfo;
CREATE TRIGGER uinfo_set_updated_at
  BEFORE UPDATE ON public.uinfo
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.uinfo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uinfo_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Students insert own uinfo log" ON public.uinfo_log;
CREATE POLICY "Students insert own uinfo log"
  ON public.uinfo_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Staff read uinfo log" ON public.uinfo_log;
CREATE POLICY "Staff read uinfo log"
  ON public.uinfo_log FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Staff delete uinfo log" ON public.uinfo_log;
CREATE POLICY "Staff delete uinfo log"
  ON public.uinfo_log FOR DELETE TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Staff read uinfo" ON public.uinfo;
CREATE POLICY "Staff read uinfo"
  ON public.uinfo FOR SELECT TO authenticated
  USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Staff write uinfo" ON public.uinfo;
CREATE POLICY "Staff write uinfo"
  ON public.uinfo FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT INSERT ON public.uinfo_log TO authenticated;
GRANT SELECT, DELETE ON public.uinfo_log TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.uinfo TO authenticated;
GRANT ALL ON public.uinfo TO service_role;
GRANT ALL ON public.uinfo_log TO service_role;
