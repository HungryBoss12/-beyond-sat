-- One monthly fee per parent class. A student is charged once for the class,
-- not once per Maths and Eng sub-class.

CREATE TABLE IF NOT EXISTS public.class_fees (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  monthly_fee_uzs bigint CHECK (monthly_fee_uzs IS NULL OR monthly_fee_uzs BETWEEN 1000 AND 100000000),
  effective_from date NOT NULL CHECK (effective_from = date_trunc('month', effective_from)::date),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, effective_from)
);

COMMENT ON COLUMN public.class_fees.monthly_fee_uzs IS 'NULL means the class is unpriced from effective_from.';

ALTER TABLE public.class_fees ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class fees admin only" ON public.class_fees;
CREATE POLICY "class fees admin only" ON public.class_fees
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

GRANT SELECT ON public.class_fees TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.class_fees FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.class_fees TO service_role;

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_charge_has_group;
ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_charge_has_class;
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_charge_has_class CHECK (
    kind <> 'charge' OR class_id IS NOT NULL OR group_id IS NOT NULL
  );

CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_live_class_charge_per_month
  ON public.ledger_entries (user_id, class_id, period)
  WHERE kind = 'charge' AND voided_at IS NULL AND group_id IS NULL;

CREATE OR REPLACE FUNCTION public.bs_class_fee_for_month(p_class_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.monthly_fee_uzs
  FROM public.class_fees f
  WHERE f.class_id = p_class_id
    AND f.effective_from <= date_trunc('month', p_month)::date
  ORDER BY f.effective_from DESC
  LIMIT 1;
$$;

-- Join month across both sub-classes: remaining lessons / all lessons that month.
CREATE OR REPLACE FUNCTION public.bs_class_join_month_charge(
  p_class_id uuid,
  p_activated_on date,
  p_fee bigint
)
RETURNS TABLE (amount_uzs bigint, remaining integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_activated_on)::date;
  v_group uuid;
BEGIN
  FOR v_group IN SELECT id FROM public.class_groups WHERE class_id = p_class_id LOOP
    PERFORM public._bs_ensure_group_lessons(v_group, v_start);
  END LOOP;
  SELECT count(*)::int,
         count(*) FILTER (WHERE l.lesson_date >= p_activated_on)::int
  INTO total, remaining
  FROM public.class_lessons l
  JOIN public.class_groups g ON g.id = l.group_id
  WHERE g.class_id = p_class_id
    AND l.lesson_date >= v_start
    AND l.lesson_date < (v_start + interval '1 month')::date;
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

CREATE OR REPLACE FUNCTION public._billing_charge_class_month(
  p_user_id uuid,
  p_class_id uuid,
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
  v_name text;
  v_activated date;
  v_fee bigint;
  v_amount bigint;
  v_remaining int;
  v_total int;
  v_active boolean := false;
  v_group uuid;
  v_id uuid;
BEGIN
  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left';
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  FOR v_group IN
    SELECT group_id FROM public.class_group_memberships
    WHERE user_id = p_user_id AND class_id = p_class_id AND status <> 'left'
  LOOP
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  v_fee := public.bs_class_fee_for_month(p_class_id, v_month);
  IF v_fee IS NULL OR v_fee <= 0 THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_name FROM public.classes WHERE id = p_class_id;
  v_amount := v_fee;
  IF v_month = date_trunc('month', v_activated)::date THEN
    SELECT j.amount_uzs, j.remaining, j.total INTO v_amount, v_remaining, v_total
    FROM public.bs_class_join_month_charge(p_class_id, v_activated, v_fee) j;
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
    p_user_id, p_class_id, NULL, 'charge', v_amount, v_month,
    CASE WHEN p_source = 'manual' THEN public.bs_tashkent_today()
         WHEN v_remaining IS NOT NULL THEN v_activated
         ELSE v_month END,
    public._billing_charge_note(v_month, v_name, v_remaining, v_total),
    p_source, v_remaining, v_total, auth.uid()
  )
  ON CONFLICT (user_id, class_id, period) WHERE kind = 'charge' AND voided_at IS NULL AND group_id IS NULL
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
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
  v_month date;
  v_end date := date_trunc('month', v_as_of)::date;
  v_added int := 0;
BEGIN
  FOR v_row IN
    SELECT m.user_id, m.class_id, min(m.activated_on) AS activated_on
    FROM public.class_group_memberships m
    WHERE m.status <> 'left' AND m.activated_on IS NOT NULL AND m.activated_on <= v_as_of
    GROUP BY m.user_id, m.class_id
  LOOP
    v_month := date_trunc('month', v_row.activated_on)::date;
    WHILE v_month <= v_end LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = v_row.user_id AND e.class_id = v_row.class_id
          AND e.group_id IS NULL AND e.kind = 'charge' AND e.period = v_month
          AND e.voided_at IS NOT NULL
          AND e.void_reason IS DISTINCT FROM 'activation date changed'
      ) THEN
        IF public._billing_charge_class_month(v_row.user_id, v_row.class_id, v_month, 'auto') IS NOT NULL THEN
          v_added := v_added + 1;
        END IF;
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_charge_month(p_user_id uuid, p_period date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', COALESCE(p_period, public.bs_tashkent_today()))::date;
  v_class uuid;
  v_added int := 0;
  v_priced int := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT class_id INTO v_class FROM public.class_memberships WHERE user_id = p_user_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Student is not in a class';
  END IF;
  IF COALESCE(public.bs_class_fee_for_month(v_class, v_month), 0) > 0 THEN
    v_priced := 1;
    IF public._billing_charge_class_month(p_user_id, v_class, v_month, 'manual') IS NOT NULL THEN
      v_added := 1;
    END IF;
  END IF;
  IF v_priced = 0 THEN
    RAISE EXCEPTION 'no_priced_groups';
  END IF;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_class_fee(
  p_class_id uuid,
  p_fee_uzs bigint,
  p_effective_from date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 1000 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Fee must be between 1 000 and 100 000 000 UZS';
  END IF;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (p_class_id, p_fee_uzs, v_from, auth.uid())
  ON CONFLICT (class_id, effective_from) DO UPDATE
    SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs, created_by = EXCLUDED.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_class_fees()
RETURNS TABLE (
  class_id uuid,
  class_name text,
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
  SELECT c.id, c.name, c.active, f.monthly_fee_uzs, f.effective_from
  FROM public.classes c
  LEFT JOIN LATERAL (
    SELECT x.monthly_fee_uzs, x.effective_from
    FROM public.class_fees x
    WHERE x.class_id = c.id
      AND x.effective_from <= date_trunc('month', public.bs_tashkent_today())::date
    ORDER BY x.effective_from DESC
    LIMIT 1
  ) f ON true
  ORDER BY c.name;
END;
$$;

-- Balances show the parent fee once (math row only, so the existing SUM is not doubled).
CREATE OR REPLACE FUNCTION public.bs_group_fee_for_month(p_user_id uuid, p_group_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN g.subject = 'math' THEN public.bs_class_fee_for_month(g.class_id, p_month) END
  FROM public.class_groups g
  WHERE g.id = p_group_id;
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
    FROM public.admin_class_fees() f
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

REVOKE ALL ON FUNCTION public.bs_class_fee_for_month(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bs_class_join_month_charge(uuid, date, bigint) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._billing_charge_class_month(uuid, uuid, date, public.ledger_source) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_class_fee(uuid, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_class_fees() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_class_fee(uuid, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_class_fees() TO authenticated;

-- Profile tiles: the class fee and the combined join month appear once (math row).
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
  v_activated date;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.status <> 'left';
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
    override_fee_uzs := NULL;
    monthly_fee_uzs := NULL;
    join_amount_uzs := NULL;
    join_remaining := NULL;
    join_total := NULL;
    charged_uzs := 0;
    charge_count := 0;
    IF v_row.subject = 'math' THEN
      monthly_fee_uzs := public.bs_class_fee_for_month(v_row.class_id, v_today);
      IF v_activated IS NOT NULL THEN
        SELECT j.* INTO v_join
        FROM public.bs_class_join_month_charge(
          v_row.class_id, v_activated, public.bs_class_fee_for_month(v_row.class_id, v_activated)
        ) j;
        join_amount_uzs := v_join.amount_uzs;
        join_remaining := v_join.remaining;
        join_total := v_join.total;
      END IF;
      SELECT COALESCE(SUM(e.amount_uzs), 0)::bigint, count(*)::int INTO charged_uzs, charge_count
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_row.class_id
        AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Per-sub-class inserts would charge the class fee again. New charges are class-level.
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
BEGIN
  RETURN NULL;
END;
$$;

-- Changing an activation date voids the class charge (group_id is null) as well as
-- any older per-sub-class auto charge, then reapplies the parent fee.
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
  v_class uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT g.class_id INTO v_class FROM public.class_groups g WHERE g.id = p_group_id;
  SELECT m.activated_on INTO v_old FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id;
  RETURN QUERY
  SELECT e.id, e.period, e.amount_uzs, e.note
  FROM public.ledger_entries e
  WHERE e.user_id = p_user_id
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND (
      e.group_id = p_group_id
      OR (e.group_id IS NULL AND e.class_id = v_class)
    )
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
  v_class uuid;
  v_activated date;
  v_month date;
  v_end date;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Pick an activation date';
  END IF;
  SELECT g.class_id INTO v_class FROM public.class_groups g WHERE g.id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  SELECT m.activated_on INTO v_old FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF v_old = p_date THEN
    RETURN 0;
  END IF;

  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'activation date changed'
  WHERE e.user_id = p_user_id
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND (
      e.group_id = p_group_id
      OR (e.group_id IS NULL AND e.class_id = v_class)
    )
    AND (
      e.period < date_trunc('month', p_date)::date
      OR e.period = date_trunc('month', p_date)::date
      OR (v_old IS NOT NULL AND e.period = date_trunc('month', v_old)::date)
    );
  GET DIAGNOSTICS v_voided = ROW_COUNT;

  UPDATE public.class_group_memberships
  SET activated_on = p_date
  WHERE group_id = p_group_id AND user_id = p_user_id;

  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = v_class
    AND m.status <> 'left' AND m.activated_on IS NOT NULL;

  IF v_activated IS NOT NULL THEN
    v_month := date_trunc('month', v_activated)::date;
    v_end := date_trunc('month', public.bs_tashkent_today())::date;
    WHILE v_month <= v_end LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = p_user_id AND e.class_id = v_class
          AND e.group_id IS NULL AND e.kind = 'charge' AND e.period = v_month
          AND e.voided_at IS NOT NULL
          AND e.void_reason IS DISTINCT FROM 'activation date changed'
      ) THEN
        PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END IF;
  RETURN v_voided;
END;
$$;
