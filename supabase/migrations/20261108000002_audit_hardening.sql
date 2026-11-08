-- Security audit follow-up.
-- 1. Admin session freshness fails closed for signed-in users without an amr claim.
-- 2. Resume an in-progress session without exposing is_correct of an active mock.
-- 3. question-images read policy: exact/substring match without LIKE wildcards.
-- 4. Defence in depth on table grants: anon cannot write, nobody can TRUNCATE/TRIGGER/REFERENCES.

-- 1 ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bs_admin_session_fresh()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    -- No user JWT at all (service role, cron, SQL editor): not a user session.
    WHEN auth.jwt() IS NULL OR coalesce(auth.jwt() ->> 'role', '') = 'service_role' THEN true
    -- A signed-in user whose token carries no sign-in record is treated as stale.
    WHEN jsonb_typeof(auth.jwt() -> 'amr') IS DISTINCT FROM 'array' THEN false
    ELSE COALESCE((
      SELECT max((a ->> 'timestamp')::bigint)
      FROM jsonb_array_elements(auth.jwt() -> 'amr') a
      WHERE (a ->> 'timestamp') ~ '^\d+$'
    ), 0) > extract(epoch FROM now()) - 12 * 3600
  END;
$$;

-- 2 ------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.my_session_attempts(p_session_id uuid)
RETURNS TABLE (
  question_id uuid,
  selected_choice_id text,
  grid_answer text,
  is_correct boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    a.question_id,
    a.selected_choice_id,
    a.grid_answer,
    CASE
      WHEN s.type = 'mock' AND s.completed_at IS NULL THEN NULL
      ELSE a.is_correct
    END
  FROM public.attempts a
  JOIN public.test_sessions s ON s.id = a.session_id
  WHERE a.session_id = p_session_id
    AND s.user_id = auth.uid()
    AND a.user_id = auth.uid()
    AND NOT public.bs_is_self_banned();
$$;

REVOKE ALL ON FUNCTION public.my_session_attempts(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_session_attempts(uuid) TO authenticated;

-- 3 ------------------------------------------------------------------------
DROP POLICY IF EXISTS "qimg read auth" ON storage.objects;
CREATE POLICY "qimg read auth"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'question-images'
    AND NOT public.bs_is_self_banned()
    AND (
      public.bs_is_staff()
      OR EXISTS (
        SELECT 1
        FROM public.questions q
        WHERE q.published IS TRUE
          AND (
            q.image_url = objects.name
            OR strpos(coalesce(q.image_url, ''), objects.name) > 0
            OR strpos(q.choices::text, objects.name) > 0
          )
      )
    )
  );

-- 4 ------------------------------------------------------------------------
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.oid, c.relname
    FROM pg_class c
    WHERE c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
  LOOP
    -- Visitors who are not signed in never write through the table API.
    EXECUTE format(
      'REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM anon',
      t.relname
    );
    -- anon only keeps SELECT on tables that actually have a policy for it.
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies p
      WHERE p.schemaname = 'public' AND p.tablename = t.relname
        AND ('anon' = ANY (p.roles) OR 'public' = ANY (p.roles))
    ) THEN
      EXECUTE format('REVOKE SELECT ON TABLE public.%I FROM anon', t.relname);
    END IF;
    EXECUTE format(
      'REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.%I FROM authenticated',
      t.relname
    );
  END LOOP;
END $$;

-- Tables created later no longer hand anon write access by default.
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON TABLES FROM anon;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261108000002', 'audit_hardening')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
