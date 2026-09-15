-- Durable flag for accounts created by staff via /api/admin/create-user.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_created boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.staff_created IS
  'True when an admin/editor created this login (create-user API). Survives email changes.';

-- Backfill from synthetic account emails still in use.
UPDATE public.profiles
SET staff_created = true
WHERE email ILIKE '%@accounts.beyondsat.local'
  AND staff_created = false;

-- Expose staff_created on admin list summary.
DROP FUNCTION IF EXISTS public.admin_users_summary();

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
  staff_created boolean
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
    coalesce(cm_class.name, c.name),
    CASE
      WHEN coalesce(att.att_total, 0) = 0 THEN NULL
      ELSE round(100.0 * att.att_correct / att.att_total)::integer
    END,
    coalesce(p.staff_created, false)
  FROM public.profiles p
  LEFT JOIN public.student_profiles sp ON sp.user_id = p.id
  LEFT JOIN public.class_memberships cm ON cm.user_id = p.id
  LEFT JOIN public.classes cm_class ON cm_class.id = cm.class_id
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
  WHERE (SELECT public.bs_is_admin())
  ORDER BY p.created_at DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.admin_users_summary() TO authenticated;
