-- A past month with no fee row of its own still uses the fee in force today,
-- so a prorated join month is not dropped.

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
    COALESCE(
      v_override,
      public.bs_class_fee_for_month(p_class_id, v_month),
      public.bs_class_fee_for_month(p_class_id, public.bs_tashkent_today())
    ),
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

SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000003', 'past_month_fee_fallback')
ON CONFLICT (version) DO NOTHING;
