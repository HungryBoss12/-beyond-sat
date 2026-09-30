-- Fees per sub-class, optional per-student overrides, ledger charges per group,
-- join-month proration by remaining lessons, and activation dates.

CREATE TABLE IF NOT EXISTS public.class_group_fees (
  group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  monthly_fee_uzs bigint CHECK (monthly_fee_uzs IS NULL OR monthly_fee_uzs BETWEEN 1000 AND 100000000),
  effective_from date NOT NULL CHECK (effective_from = date_trunc('month', effective_from)::date),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, effective_from)
);

COMMENT ON COLUMN public.class_group_fees.monthly_fee_uzs IS 'NULL means the group is unpriced from effective_from.';

ALTER TABLE public.class_group_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group fees admin only" ON public.class_group_fees;
CREATE POLICY "group fees admin only" ON public.class_group_fees
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

GRANT SELECT ON public.class_group_fees TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.class_group_fees FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.class_group_fees TO service_role;

-- v1 per-student fees (0 rows) become per-group overrides.
DO $$
BEGIN
  IF to_regclass('public.student_fees') IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.student_fees) THEN
      RAISE EXCEPTION 'student_fees has rows. Move them to group fees by hand first.';
    END IF;
    ALTER TABLE public.student_fees RENAME TO student_fee_overrides;
  END IF;
END $$;

ALTER TABLE public.student_fee_overrides
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE;
ALTER TABLE public.student_fee_overrides ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.student_fee_overrides ALTER COLUMN monthly_fee_uzs DROP NOT NULL;
ALTER TABLE public.student_fee_overrides DROP CONSTRAINT IF EXISTS student_fees_monthly_fee_uzs_check;
ALTER TABLE public.student_fee_overrides DROP CONSTRAINT IF EXISTS student_fee_overrides_fee_ok;
ALTER TABLE public.student_fee_overrides
  ADD CONSTRAINT student_fee_overrides_fee_ok
  CHECK (monthly_fee_uzs IS NULL OR monthly_fee_uzs BETWEEN 0 AND 100000000);
ALTER TABLE public.student_fee_overrides DROP CONSTRAINT IF EXISTS student_fee_overrides_month_ok;
ALTER TABLE public.student_fee_overrides
  ADD CONSTRAINT student_fee_overrides_month_ok
  CHECK (effective_from = date_trunc('month', effective_from)::date);
ALTER TABLE public.student_fee_overrides DROP CONSTRAINT IF EXISTS student_fees_pkey;
ALTER TABLE public.student_fee_overrides DROP CONSTRAINT IF EXISTS student_fee_overrides_pkey;
ALTER TABLE public.student_fee_overrides
  ADD CONSTRAINT student_fee_overrides_pkey PRIMARY KEY (user_id, group_id, effective_from);

COMMENT ON COLUMN public.student_fee_overrides.monthly_fee_uzs IS
  'NULL = use the group fee again; 0 = free for this student.';

DROP POLICY IF EXISTS "fees admin only" ON public.student_fee_overrides;
DROP POLICY IF EXISTS "fee overrides admin only" ON public.student_fee_overrides;
CREATE POLICY "fee overrides admin only" ON public.student_fee_overrides
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

-- Ledger rows carry the group and the proration used.
ALTER TABLE public.ledger_entries
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id),
  ADD COLUMN IF NOT EXISTS prorate_lessons smallint,
  ADD COLUMN IF NOT EXISTS prorate_total smallint;

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_charge_has_group;
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_charge_has_group CHECK (kind <> 'charge' OR group_id IS NOT NULL);

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_prorate_ok;
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_prorate_ok CHECK (
    (prorate_lessons IS NULL AND prorate_total IS NULL)
    OR (prorate_lessons > 0 AND prorate_total > 0 AND prorate_lessons <= prorate_total)
  );

DROP INDEX IF EXISTS public.ledger_one_live_charge_per_month;
CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_live_charge_per_group_month
  ON public.ledger_entries (user_id, group_id, period)
  WHERE kind = 'charge' AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_group_idx
  ON public.ledger_entries (group_id, period);

CREATE OR REPLACE FUNCTION public.ledger_entries_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ledger rows cannot be deleted';
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

CREATE OR REPLACE FUNCTION public.classes_guard_money()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.ledger_entries e
    WHERE e.class_id = OLD.id
       OR e.group_id IN (SELECT g.id FROM public.class_groups g WHERE g.class_id = OLD.id)
  ) THEN
    RAISE EXCEPTION 'This class has payment history and cannot be deleted. Mark it inactive instead.';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS classes_guard_money ON public.classes;
CREATE TRIGGER classes_guard_money
  BEFORE DELETE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_guard_money();

-- Old per-student helpers are replaced by per-group ones.
DROP FUNCTION IF EXISTS public.admin_set_monthly_fee(uuid, bigint, date);
DROP FUNCTION IF EXISTS public.admin_charge_month(uuid, date);
DROP FUNCTION IF EXISTS public.admin_student_ledger(uuid);
DROP FUNCTION IF EXISTS public.admin_student_balances(text, uuid, text, text, bigint, bigint, date, text, integer);
DROP FUNCTION IF EXISTS public.bs_fee_for_month(uuid, date);
DROP FUNCTION IF EXISTS public.bs_member_active_in_month(uuid, date);

CREATE OR REPLACE FUNCTION public.bs_group_fee_for_month(p_user_id uuid, p_group_id uuid, p_month date)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_found boolean;
  v_fee bigint;
BEGIN
  SELECT true, o.monthly_fee_uzs INTO v_found, v_fee
  FROM public.student_fee_overrides o
  WHERE o.user_id = p_user_id AND o.group_id = p_group_id AND o.effective_from <= v_month
  ORDER BY o.effective_from DESC
  LIMIT 1;
  IF v_found AND v_fee IS NOT NULL THEN
    RETURN v_fee;
  END IF;
  SELECT f.monthly_fee_uzs INTO v_fee
  FROM public.class_group_fees f
  WHERE f.group_id = p_group_id AND f.effective_from <= v_month
  ORDER BY f.effective_from DESC
  LIMIT 1;
  RETURN v_fee;
END;
$$;

-- Charge for the join month: fee x remaining / total lessons, rounded half-up to 1 000.
CREATE OR REPLACE FUNCTION public.bs_join_month_charge(p_group_id uuid, p_activated_on date, p_fee bigint)
RETURNS TABLE (amount_uzs bigint, remaining integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_activated_on)::date;
  v_end date := (date_trunc('month', p_activated_on) + interval '1 month' - interval '1 day')::date;
BEGIN
  PERFORM public._bs_ensure_group_lessons(p_group_id, v_start);
  SELECT count(*)::int, count(*) FILTER (WHERE l.lesson_date >= p_activated_on)::int
  INTO total, remaining
  FROM public.class_lessons l
  WHERE l.group_id = p_group_id AND l.lesson_date BETWEEN v_start AND v_end;
  IF p_fee IS NULL OR p_fee <= 0 THEN
    amount_uzs := 0;
  ELSIF total = 0 THEN
    amount_uzs := p_fee;
  ELSE
    amount_uzs := (round(p_fee::numeric * remaining / total / 1000) * 1000)::bigint;
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_member_active_in_group_month(p_user_id uuid, p_group_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM generate_series(
      date_trunc('month', p_month)::date,
      (date_trunc('month', p_month)::date + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    ) AS d(day)
    WHERE (
      SELECT e.status
      FROM public.class_membership_events e
      WHERE e.user_id = p_user_id
        AND e.group_id = p_group_id
        AND e.kind = 'status'
        AND e.effective_on <= d.day::date
      ORDER BY e.effective_on DESC, e.created_at DESC
      LIMIT 1
    ) = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public._billing_charge_note(
  p_month date,
  p_group_name text,
  p_remaining integer,
  p_total integer
)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'Course fee · ' || to_char(p_month, 'FMMonth YYYY') || ' · ' || p_group_name
    || CASE WHEN p_remaining IS NOT NULL THEN ' · ' || p_remaining || '/' || p_total || ' lessons' ELSE '' END;
$$;

-- One month's charge for one student in one group. Returns the new row id or NULL.
CREATE OR REPLACE FUNCTION public._billing_charge_group_month(
  p_user_id uuid,
  p_group_id uuid,
  p_month date,
  p_source public.ledger_source
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_member public.class_group_memberships%ROWTYPE;
  v_group public.class_groups%ROWTYPE;
  v_fee bigint;
  v_amount bigint;
  v_remaining int;
  v_total int;
  v_id uuid;
BEGIN
  SELECT * INTO v_member FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_member.activated_on IS NULL
     OR v_month < date_trunc('month', v_member.activated_on)::date THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_group FROM public.class_groups WHERE id = p_group_id;
  v_fee := public.bs_group_fee_for_month(p_user_id, p_group_id, v_month);
  IF v_fee IS NULL OR v_fee <= 0 THEN
    RETURN NULL;
  END IF;

  v_amount := v_fee;
  IF v_month = date_trunc('month', v_member.activated_on)::date THEN
    SELECT j.amount_uzs, j.remaining, j.total INTO v_amount, v_remaining, v_total
    FROM public.bs_join_month_charge(p_group_id, v_member.activated_on, v_fee) j;
    IF v_total = 0 OR v_remaining = v_total THEN
      v_remaining := NULL;
      v_total := NULL;
    END IF;
  END IF;
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
    prorate_lessons, prorate_total, created_by
  )
  VALUES (
    p_user_id, v_group.class_id, p_group_id, 'charge', v_amount, v_month,
    CASE WHEN p_source = 'manual' THEN public.bs_tashkent_today()
         WHEN v_remaining IS NOT NULL THEN v_member.activated_on
         ELSE v_month END,
    public._billing_charge_note(v_month, v_group.name, v_remaining, v_total),
    p_source, v_remaining, v_total, auth.uid()
  )
  ON CONFLICT (user_id, group_id, period) WHERE kind = 'charge' AND voided_at IS NULL
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Auto-charges every billable month for one membership. A month an admin voided
-- by hand stays voided; only activation-date voids are re-applied.
CREATE OR REPLACE FUNCTION public._billing_apply_for_member(p_user_id uuid, p_group_id uuid, p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member public.class_group_memberships%ROWTYPE;
  v_month date;
  v_end date := date_trunc('month', p_as_of)::date;
  v_added int := 0;
BEGIN
  SELECT * INTO v_member FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_member.activated_on IS NULL THEN
    RETURN 0;
  END IF;
  v_month := date_trunc('month', v_member.activated_on)::date;
  WHILE v_month <= v_end LOOP
    IF public.bs_member_active_in_group_month(p_user_id, p_group_id, v_month)
       AND NOT EXISTS (
         SELECT 1 FROM public.ledger_entries e
         WHERE e.user_id = p_user_id AND e.group_id = p_group_id AND e.kind = 'charge'
           AND e.period = v_month AND e.voided_at IS NOT NULL
           AND e.void_reason IS DISTINCT FROM 'activation date changed'
       ) THEN
      IF public._billing_charge_group_month(p_user_id, p_group_id, v_month, 'auto') IS NOT NULL THEN
        v_added := v_added + 1;
      END IF;
    END IF;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public._billing_apply_recurring_fees(p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of date := COALESCE(p_as_of, public.bs_tashkent_today());
  v_row record;
  v_added int := 0;
BEGIN
  FOR v_row IN
    SELECT m.user_id, m.group_id
    FROM public.class_group_memberships m
    WHERE m.activated_on IS NOT NULL AND m.activated_on <= v_as_of
  LOOP
    v_added := v_added + public._billing_apply_for_member(v_row.user_id, v_row.group_id, v_as_of);
  END LOOP;
  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_group_fee_for_month(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bs_join_month_charge(uuid, date, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bs_member_active_in_group_month(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._billing_charge_note(date, text, integer, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._billing_charge_group_month(uuid, uuid, date, public.ledger_source) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._billing_apply_for_member(uuid, uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._billing_apply_recurring_fees(date) FROM PUBLIC, anon, authenticated;

-- Admin RPCs ------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_charge_month(p_user_id uuid, p_period date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', COALESCE(p_period, public.bs_tashkent_today()))::date;
  v_group uuid;
  v_priced int := 0;
  v_added int := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_group IN SELECT group_id FROM public.class_group_memberships WHERE user_id = p_user_id LOOP
    IF COALESCE(public.bs_group_fee_for_month(p_user_id, v_group, v_month), 0) > 0 THEN
      v_priced := v_priced + 1;
      IF public._billing_charge_group_month(p_user_id, v_group, v_month, 'manual') IS NOT NULL THEN
        v_added := v_added + 1;
      END IF;
    END IF;
  END LOOP;
  IF v_priced = 0 THEN
    RAISE EXCEPTION 'no_priced_groups';
  END IF;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_group_fee(
  p_group_id uuid,
  p_fee_uzs bigint,
  p_effective_from date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 1000 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Monthly fee must be between 1 000 and 100 000 000 UZS';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_groups WHERE id = p_group_id) THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  INSERT INTO public.class_group_fees (group_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (
    p_group_id, p_fee_uzs,
    date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date,
    auth.uid()
  )
  ON CONFLICT (group_id, effective_from) DO UPDATE
    SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
        created_by = EXCLUDED.created_by,
        created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_fee_override(
  p_user_id uuid,
  p_group_id uuid,
  p_fee_uzs bigint,
  p_effective_from date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 0 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Override must be between 0 and 100 000 000 UZS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  INSERT INTO public.student_fee_overrides (user_id, group_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (
    p_user_id, p_group_id, p_fee_uzs,
    date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date,
    auth.uid()
  )
  ON CONFLICT (user_id, group_id, effective_from) DO UPDATE
    SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
        created_by = EXCLUDED.created_by,
        created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_group_fees()
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  class_name text,
  group_name text,
  subject public.class_subject,
  active boolean,
  monthly_fee_uzs bigint,
  effective_from date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  SELECT g.id, g.class_id, c.name, g.name, g.subject, (g.active AND c.active),
         f.monthly_fee_uzs, f.effective_from
  FROM public.class_groups g
  JOIN public.classes c ON c.id = g.class_id
  LEFT JOIN LATERAL (
    SELECT x.monthly_fee_uzs, x.effective_from
    FROM public.class_group_fees x
    WHERE x.group_id = g.id
      AND x.effective_from <= date_trunc('month', public.bs_tashkent_today())::date
    ORDER BY x.effective_from DESC
    LIMIT 1
  ) f ON true
  ORDER BY c.name, g.subject;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_preview_activation_change(
  p_user_id uuid,
  p_group_id uuid,
  p_date date
)
RETURNS TABLE (id uuid, period date, amount_uzs bigint, note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old date;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT activated_on INTO v_old FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  RETURN QUERY
  SELECT e.id, e.period, e.amount_uzs, e.note
  FROM public.ledger_entries e
  WHERE e.user_id = p_user_id AND e.group_id = p_group_id
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND (
      e.period < date_trunc('month', p_date)::date
      OR e.period = date_trunc('month', p_date)::date
      OR (v_old IS NOT NULL AND e.period = date_trunc('month', v_old)::date)
    )
  ORDER BY e.period;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_activation_date(
  p_user_id uuid,
  p_group_id uuid,
  p_date date
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old date;
  v_voided int;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Pick an activation date';
  END IF;
  SELECT activated_on INTO v_old FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF v_old = p_date THEN
    RETURN 0;
  END IF;

  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'activation date changed'
  WHERE e.user_id = p_user_id AND e.group_id = p_group_id
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND (
      e.period < date_trunc('month', p_date)::date
      OR e.period = date_trunc('month', p_date)::date
      OR (v_old IS NOT NULL AND e.period = date_trunc('month', v_old)::date)
    );
  GET DIAGNOSTICS v_voided = ROW_COUNT;

  UPDATE public.class_group_memberships
  SET activated_on = p_date
  WHERE group_id = p_group_id AND user_id = p_user_id;

  PERFORM public._billing_apply_for_member(p_user_id, p_group_id, public.bs_tashkent_today());
  RETURN v_voided;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_billing(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  group_name text,
  subject public.class_subject,
  status public.class_member_status,
  enrolled_on date,
  activated_on date,
  monthly_fee_uzs bigint,
  override_fee_uzs bigint,
  join_amount_uzs bigint,
  join_remaining integer,
  join_total integer,
  charged_uzs bigint,
  charge_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_join record;
  v_today date := public.bs_tashkent_today();
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_row IN
    SELECT m.*, g.name AS gname
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
    ORDER BY g.subject
  LOOP
    group_id := v_row.group_id;
    class_id := v_row.class_id;
    group_name := v_row.gname;
    subject := v_row.subject;
    status := v_row.status;
    enrolled_on := v_row.enrolled_on;
    activated_on := v_row.activated_on;
    monthly_fee_uzs := public.bs_group_fee_for_month(p_user_id, v_row.group_id, v_today);
    SELECT o.monthly_fee_uzs INTO override_fee_uzs
    FROM public.student_fee_overrides o
    WHERE o.user_id = p_user_id AND o.group_id = v_row.group_id
      AND o.effective_from <= date_trunc('month', v_today)::date
    ORDER BY o.effective_from DESC
    LIMIT 1;
    join_amount_uzs := NULL;
    join_remaining := NULL;
    join_total := NULL;
    IF v_row.activated_on IS NOT NULL THEN
      SELECT j.* INTO v_join
      FROM public.bs_join_month_charge(
        v_row.group_id,
        v_row.activated_on,
        public.bs_group_fee_for_month(p_user_id, v_row.group_id, v_row.activated_on)
      ) j;
      join_amount_uzs := v_join.amount_uzs;
      join_remaining := v_join.remaining;
      join_total := v_join.total;
    END IF;
    SELECT COALESCE(SUM(e.amount_uzs), 0)::bigint, count(*)::int INTO charged_uzs, charge_count
    FROM public.ledger_entries e
    WHERE e.user_id = p_user_id AND e.group_id = v_row.group_id
      AND e.kind = 'charge' AND e.voided_at IS NULL;
    RETURN NEXT;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_ledger(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  kind public.ledger_kind,
  amount_uzs bigint,
  period date,
  method public.pay_method,
  occurred_on date,
  note text,
  source public.ledger_source,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz,
  group_id uuid,
  group_name text,
  subject public.class_subject,
  prorate_lessons smallint,
  prorate_total smallint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  SELECT e.id, e.kind, e.amount_uzs, e.period, e.method, e.occurred_on, e.note, e.source,
         e.voided_at, e.void_reason, e.created_at, e.group_id, g.name, g.subject,
         e.prorate_lessons, e.prorate_total
  FROM public.ledger_entries e
  LEFT JOIN public.class_groups g ON g.id = e.group_id
  WHERE e.user_id = p_user_id
  ORDER BY e.occurred_on DESC, e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_balances(
  p_search text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_min_balance bigint DEFAULT NULL,
  p_max_balance bigint DEFAULT NULL,
  p_month date DEFAULT NULL,
  p_rank text DEFAULT NULL,
  p_months_in_debt integer DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  phone text,
  class_id uuid,
  class_name text,
  status public.class_member_status,
  groups jsonb,
  rw smallint,
  math smallint,
  total_score integer,
  rank_letter text,
  monthly_fee bigint,
  charged bigint,
  paid bigint,
  balance bigint,
  last_payment_on date,
  months_in_debt integer,
  recent jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.bs_tashkent_today();
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT m.user_id FROM public.class_memberships m
    UNION
    SELECT e.user_id FROM public.ledger_entries e
  ),
  base AS (
    SELECT
      pp.user_id,
      p.full_name,
      p.username,
      sc.phone,
      m.class_id,
      cl.name AS class_name,
      m.status,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'subject', g.subject, 'status', gm.status,
          'activated_on', gm.activated_on
        ) ORDER BY g.subject)
        FROM public.class_group_memberships gm
        JOIN public.class_groups g ON g.id = gm.group_id
        WHERE gm.user_id = pp.user_id
      ), '[]'::jsonb) AS groups,
      s.rw,
      s.math,
      COALESCE(s.rw, 0) + COALESCE(s.math, 0) AS total_score,
      public.bs_student_balance(pp.user_id) AS balance,
      (
        SELECT SUM(public.bs_group_fee_for_month(pp.user_id, gm.group_id, v_today))
        FROM public.class_group_memberships gm
        WHERE gm.user_id = pp.user_id
      )::bigint AS monthly_fee,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'charge' AND e.voided_at IS NULL
      ), 0)::bigint AS charged,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ), 0)::bigint AS paid,
      (
        SELECT MAX(e.occurred_on) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ) AS last_payment_on,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'kind', r.kind, 'amount_uzs', r.amount_uzs::text,
          'note', r.note, 'occurred_on', r.occurred_on, 'source', r.source
        ) ORDER BY r.occurred_on DESC, r.created_at DESC)
        FROM (
          SELECT e.id, e.kind, e.amount_uzs, e.note, e.occurred_on, e.source, e.created_at
          FROM public.ledger_entries e
          WHERE e.user_id = pp.user_id AND e.voided_at IS NULL
          ORDER BY e.occurred_on DESC, e.created_at DESC
          LIMIT 4
        ) r
      ), '[]'::jsonb) AS recent
    FROM people pp
    JOIN public.profiles p ON p.id = pp.user_id
    LEFT JOIN public.class_memberships m ON m.user_id = pp.user_id
    LEFT JOIN public.classes cl ON cl.id = m.class_id
    LEFT JOIN public.student_contacts sc ON sc.user_id = pp.user_id
    LEFT JOIN public.student_scores s ON s.user_id = pp.user_id
  ),
  debt AS (
    SELECT
      b.*,
      CASE
        WHEN b.balance >= 0 THEN 0
        ELSE COALESCE((
          SELECT COUNT(DISTINCT e.period)::int
          FROM public.ledger_entries e
          WHERE e.user_id = b.user_id
            AND e.kind = 'charge'
            AND e.voided_at IS NULL
            AND e.period >= COALESCE((
              SELECT date_trunc('month', MAX(pmt.occurred_on))::date
              FROM public.ledger_entries pmt
              WHERE pmt.user_id = b.user_id AND pmt.kind = 'payment' AND pmt.voided_at IS NULL
            ), e.period)
        ), 0)
      END AS months_in_debt
    FROM base b
  )
  SELECT
    d.user_id, d.full_name, d.username, d.phone, d.class_id, d.class_name, d.status, d.groups,
    d.rw, d.math, d.total_score::int, public.bs_rank_letter(d.total_score::int),
    d.monthly_fee, d.charged, d.paid, d.balance, d.last_payment_on, d.months_in_debt, d.recent
  FROM debt d
  WHERE (p_search IS NULL OR p_search = '' OR (
      d.full_name ILIKE '%' || p_search || '%'
      OR d.username ILIKE '%' || p_search || '%'
      OR COALESCE(d.phone, '') ILIKE '%' || p_search || '%'
    ))
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM public.class_group_memberships gm
      WHERE gm.user_id = d.user_id AND gm.group_id = p_group_id
    ))
    AND (p_class_id IS NULL OR d.class_id = p_class_id)
    AND (p_status IS NULL OR p_status = '' OR d.status::text = p_status)
    AND (p_kind IS NULL OR p_kind = '' OR p_kind = 'all' OR (
      (p_kind = 'debt' AND d.balance < 0)
      OR (p_kind = 'credit' AND d.balance > 0)
      OR (p_kind = 'settled' AND d.balance = 0)
    ))
    AND (p_min_balance IS NULL OR d.balance >= p_min_balance)
    AND (p_max_balance IS NULL OR d.balance <= p_max_balance)
    AND (p_rank IS NULL OR p_rank = '' OR public.bs_rank_letter(d.total_score::int) = p_rank)
    AND (
      p_month IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = d.user_id
          AND e.kind = 'charge'
          AND e.voided_at IS NULL
          AND e.period = date_trunc('month', p_month)::date
      )
    )
    AND (p_months_in_debt IS NULL OR d.months_in_debt >= p_months_in_debt)
  ORDER BY d.balance ASC, d.full_name ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_payments_summary()
RETURNS TABLE (
  total_owed bigint,
  debtors integer,
  credits bigint,
  creditors integer,
  settled integer,
  priced_groups integer,
  active_groups integer,
  min_fee bigint,
  max_fee bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT m.user_id FROM public.class_memberships m
    UNION
    SELECT e.user_id FROM public.ledger_entries e
  ),
  b AS (
    SELECT public.bs_student_balance(pp.user_id) AS bal FROM people pp
  ),
  fees AS (
    SELECT f.monthly_fee_uzs
    FROM public.admin_group_fees() f
    WHERE f.active
  )
  SELECT
    COALESCE(SUM(-b.bal) FILTER (WHERE b.bal < 0), 0)::bigint,
    COUNT(*) FILTER (WHERE b.bal < 0)::int,
    COALESCE(SUM(b.bal) FILTER (WHERE b.bal > 0), 0)::bigint,
    COUNT(*) FILTER (WHERE b.bal > 0)::int,
    COUNT(*) FILTER (WHERE b.bal = 0)::int,
    (SELECT COUNT(*) FROM fees WHERE fees.monthly_fee_uzs IS NOT NULL)::int,
    (SELECT COUNT(*) FROM fees)::int,
    (SELECT MIN(fees.monthly_fee_uzs) FROM fees),
    (SELECT MAX(fees.monthly_fee_uzs) FROM fees)
  FROM b;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_charge_month(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_group_fee(uuid, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_fee_override(uuid, uuid, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_group_fees() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_preview_activation_change(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_set_activation_date(uuid, uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_student_billing(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_student_ledger(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_student_balances(text, uuid, uuid, text, text, bigint, bigint, date, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_payments_summary() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_charge_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_group_fee(uuid, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_fee_override(uuid, uuid, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_group_fees() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_preview_activation_change(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_set_activation_date(uuid, uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_billing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_ledger(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_balances(text, uuid, uuid, text, text, bigint, bigint, date, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_payments_summary() TO authenticated;
