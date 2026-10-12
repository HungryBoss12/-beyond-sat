-- Set a student's balance with one adjustment, and charge every month from
-- activation through this month when that month has no live charge.

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
  v_override bigint;
  v_amount bigint;
  v_remaining int;
  v_total int;
  v_active boolean := false;
  v_group uuid;
  v_id uuid;
  v_subjects int;
BEGIN
  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  FOR v_group IN
    SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = p_class_id
  LOOP
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  -- A student with an activation date is billable for that month even when the
  -- daily status log has no row. Leaving is already excluded above.
  IF NOT v_active THEN
    v_active := v_activated <= (v_month + interval '1 month' - interval '1 day')::date;
  END IF;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(DISTINCT c.subject)::int INTO v_subjects
  FROM public.bs_counted_groups(p_user_id) c
  WHERE c.class_id = p_class_id;
  v_override := public.bs_student_class_override(p_user_id, p_class_id, v_month);
  v_fee := public.bs_half_subject_amount(
    COALESCE(v_override, public.bs_class_fee_for_month(p_class_id, v_month)),
    v_subjects
  );
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
  v_amount := public.bs_apply_discount(p_user_id, p_class_id, v_amount, v_month);
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
          AND e.voided_at IS NULL
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

CREATE OR REPLACE FUNCTION public.admin_set_student_balance(p_user_id uuid, p_balance bigint)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now bigint;
  v_delta bigint;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_balance IS NULL OR p_balance < -1000000000 OR p_balance > 1000000000 THEN
    RAISE EXCEPTION 'Balance is out of range';
  END IF;
  v_now := public.bs_student_balance(p_user_id);
  v_delta := p_balance - v_now;
  IF v_delta = 0 THEN
    RETURN;
  END IF;
  IF v_delta > 0 THEN
    INSERT INTO public.ledger_entries (
      user_id, kind, amount_uzs, occurred_on, note, source, created_by
    )
    VALUES (
      p_user_id, 'discount', v_delta, public.bs_tashkent_today(),
      'Balance set by admin', 'manual', auth.uid()
    );
  ELSE
    INSERT INTO public.ledger_entries (
      user_id, kind, amount_uzs, period, occurred_on, note, source, created_by
    )
    VALUES (
      p_user_id, 'charge', -v_delta, date_trunc('month', public.bs_tashkent_today())::date,
      public.bs_tashkent_today(), 'Balance set by admin', 'manual', auth.uid()
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_balance(uuid, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_balance(uuid, bigint) TO authenticated, service_role;

SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000002', 'balance_and_month_backfill')
ON CONFLICT (version) DO NOTHING;
