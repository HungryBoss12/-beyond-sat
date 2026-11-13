-- An admin Delete holds the account for 14 days. The login is removed after that
-- only when the balance is zero. A credit or a debt stays in the basket.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS profiles_deleted_at_idx
  ON public.profiles (deleted_at)
  WHERE deleted_at IS NOT NULL;

-- A student cannot clear their own hold by editing the profile.
CREATE OR REPLACE FUNCTION public.profiles_keep_deleted_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     AND current_user NOT IN ('postgres', 'supabase_admin')
     AND NOT public.bs_is_admin() THEN
    NEW.deleted_at := OLD.deleted_at;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_keep_deleted_at ON public.profiles;
CREATE TRIGGER profiles_keep_deleted_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_keep_deleted_at();

CREATE OR REPLACE FUNCTION public.admin_hold_student(p_user_id uuid)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_at timestamptz;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account here.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_user_id
      AND r.role IN ('admin', 'editor', 'teacher', 'support_teacher')
  ) THEN
    RAISE EXCEPTION 'Only student accounts can be deleted here.';
  END IF;
  UPDATE public.profiles
  SET deleted_at = COALESCE(deleted_at, now())
  WHERE id = p_user_id
  RETURNING deleted_at INTO v_at;
  IF v_at IS NULL THEN
    RAISE EXCEPTION 'Student not found.';
  END IF;
  RETURN v_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_student(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.profiles
  SET deleted_at = NULL
  WHERE id = p_user_id AND deleted_at IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_basket()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  phone text,
  balance bigint,
  deleted_at timestamptz,
  class_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.username,
    sc.phone,
    public.bs_student_balance(p.id),
    p.deleted_at,
    (
      SELECT e.class_id
      FROM public.ledger_entries e
      WHERE e.user_id = p.id
        AND e.kind = 'charge'
        AND e.class_id IS NOT NULL
      ORDER BY e.occurred_on DESC, e.created_at DESC
      LIMIT 1
    )
  FROM public.profiles p
  LEFT JOIN public.student_contacts sc ON sc.user_id = p.id
  WHERE p.deleted_at IS NOT NULL
    AND public.bs_is_admin()
  ORDER BY p.deleted_at;
$$;

-- Settled history may leave with the login. Any other delete is still refused.
CREATE OR REPLACE FUNCTION public.ledger_entries_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF current_setting('bs.purge_account', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'Ledger rows cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.amount_uzs IS DISTINCT FROM OLD.amount_uzs
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.period IS DISTINCT FROM OLD.period
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.prorate_lessons IS DISTINCT FROM OLD.prorate_lessons
     OR NEW.prorate_total IS DISTINCT FROM OLD.prorate_total
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Ledger rows are append-only';
  END IF;
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Voided rows cannot be changed';
  END IF;
  IF NEW.voided_at IS NOT NULL AND COALESCE(btrim(NEW.void_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason required';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.purge_settled_student_accounts()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_n integer := 0;
BEGIN
  PERFORM set_config('bs.purge_account', 'on', true);
  FOR v_id IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.deleted_at IS NOT NULL
      AND p.deleted_at <= now() - interval '14 days'
      AND public.bs_student_balance(p.id) = 0
  LOOP
    BEGIN
      DELETE FROM auth.users WHERE id = v_id;
      v_n := v_n + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Could not remove %: %', v_id, SQLERRM;
    END;
  END LOOP;
  PERFORM set_config('bs.purge_account', '', true);
  RETURN v_n;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_users_summary()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  username text,
  created_at timestamptz,
  last_seen_at timestamptz,
  banned boolean,
  role text,
  tests_total bigint,
  tests_mock bigint,
  tests_daily bigint,
  tests_practice bigint,
  current_streak integer,
  last_active_at timestamptz,
  class_name text,
  accuracy_pct integer,
  staff_created boolean,
  badge_score integer,
  badge_label text,
  badge_color text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.username,
    p.created_at,
    p.last_seen_at,
    coalesce(p.banned, false),
    public.admin_user_role(p.id),
    coalesce(ts.tests_total, 0),
    coalesce(ts.tests_mock, 0),
    coalesce(ts.tests_daily, 0),
    coalesce(ts.tests_practice, 0),
    coalesce(sp.current_streak, 0),
    sp.last_active_at,
    coalesce(memberships.class_name, c.name),
    CASE
      WHEN coalesce(att.att_total, 0) = 0 THEN NULL
      ELSE round(100.0 * att.att_correct / att.att_total)::integer
    END,
    coalesce(p.staff_created, false),
    p.badge_score,
    p.badge_label,
    p.badge_color
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN LATERAL (
    SELECT string_agg(cls.name, ', ' ORDER BY cls.name) AS class_name
    FROM public.class_memberships m
    JOIN public.classes cls ON cls.id = m.class_id
    WHERE m.user_id = p.id
  ) memberships ON true
  LEFT JOIN public.classes c ON c.id = p.class_id
  LEFT JOIN LATERAL (
    SELECT
      count(*)::bigint AS tests_total,
      count(*) FILTER (WHERE s.type = 'mock')::bigint AS tests_mock,
      count(*) FILTER (WHERE s.type = 'daily')::bigint AS tests_daily,
      count(*) FILTER (WHERE s.type = 'practice')::bigint AS tests_practice
    FROM public.test_sessions s
    WHERE s.user_id = p.id
  ) ts ON true
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE a.is_correct IS NOT NULL)::bigint AS att_total,
      count(*) FILTER (WHERE a.is_correct = true)::bigint AS att_correct
    FROM public.attempts a
    WHERE a.user_id = p.id
  ) att ON true
  WHERE p.deleted_at IS NULL
    AND (SELECT public.bs_is_admin())
  ORDER BY p.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_hold_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_hold_student(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_restore_student(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_restore_student(uuid) TO authenticated;

REVOKE ALL ON FUNCTION public.admin_student_basket() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_basket() TO authenticated;

REVOKE ALL ON FUNCTION public.purge_settled_student_accounts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_settled_student_accounts() TO service_role;

REVOKE ALL ON FUNCTION public.admin_users_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261114000001', 'student_basket')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
