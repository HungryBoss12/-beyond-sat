-- An activation date edit reprices only the open month. A closed month that was already
-- billed keeps its charge, and the change for that one group is appended: an extra charge
-- when the group now starts earlier, a credit when it starts later.

CREATE OR REPLACE FUNCTION public.admin_set_activation_date(p_user_id uuid, p_group_id uuid, p_date date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old date;
  v_enrolled date;
  v_class uuid;
  v_name text;
  v_open date := date_trunc('month', public.bs_tashkent_today())::date;
  v_month date;
  v_last_closed date;
  v_month_end date;
  v_old_amt bigint;
  v_new_amt bigint;
  v_diff bigint;
  v_note text;
  v_changed int := 0;
  v_activated date;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_date IS NULL THEN
    RAISE EXCEPTION 'Pick an activation date';
  END IF;
  SELECT g.class_id, g.name INTO v_class, v_name FROM public.class_groups g WHERE g.id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  SELECT m.activated_on, m.enrolled_on INTO v_old, v_enrolled
  FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  v_old := COALESCE(v_old, v_enrolled);
  IF v_old = p_date THEN
    RETURN 0;
  END IF;

  v_month := date_trunc('month', LEAST(v_old, p_date))::date;
  v_last_closed := LEAST(date_trunc('month', GREATEST(v_old, p_date))::date, (v_open - interval '1 month')::date);
  WHILE v_month <= v_last_closed LOOP
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_class AND e.group_id IS NULL
        AND e.kind = 'charge' AND e.period = v_month AND e.voided_at IS NULL
    ) AND NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_class
        AND e.kind = 'charge' AND e.period = v_month AND e.void_reason = 'payments reset'
    ) THEN
      v_month_end := (v_month + interval '1 month')::date - 1;
      SELECT s.amount INTO v_old_amt
      FROM public._billing_group_span(p_user_id, p_group_id, v_month, v_old, v_month_end) s;
      SELECT s.amount INTO v_new_amt
      FROM public._billing_group_span(p_user_id, p_group_id, v_month, p_date, v_month_end) s;
      v_diff := COALESCE(v_new_amt, 0) - COALESCE(v_old_amt, 0);
      v_note := 'Activation date change · ' || to_char(v_month, 'FMMonth YYYY') || ' · ' || v_name
        || ' · ' || to_char(v_old, 'DD.MM') || ' → ' || to_char(p_date, 'DD.MM');
      IF v_diff > 0 THEN
        INSERT INTO public.ledger_entries (
          user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
        )
        VALUES (
          p_user_id, v_class, p_group_id, 'charge', v_diff, v_month, public.bs_tashkent_today(),
          v_note, 'manual', auth.uid()
        );
        v_changed := v_changed + 1;
      ELSIF v_diff < 0 THEN
        INSERT INTO public.ledger_entries (
          user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
        )
        VALUES (
          p_user_id, v_class, p_group_id, 'discount', -v_diff, v_month, public.bs_tashkent_today(),
          v_note, 'manual', auth.uid()
        );
        v_changed := v_changed + 1;
      END IF;
    END IF;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;

  UPDATE public.class_group_memberships
  SET activated_on = p_date
  WHERE group_id = p_group_id AND user_id = p_user_id;

  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'activation date changed'
  WHERE e.user_id = p_user_id AND e.class_id = v_class AND e.group_id IS NULL
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND e.period = v_open;
  v_changed := v_changed + (SELECT count(*) FROM public.ledger_entries e
    WHERE e.user_id = p_user_id AND e.class_id = v_class AND e.period = v_open
      AND e.void_reason = 'activation date changed' AND e.voided_at > now() - interval '1 second')::int;

  SELECT min(COALESCE(m.activated_on, m.enrolled_on)) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = v_class AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);

  -- Months that were never billed (none live, none reset) are billed whole; the open month is rebuilt.
  IF v_activated IS NOT NULL THEN
    v_month := date_trunc('month', v_activated)::date;
    WHILE v_month <= v_open LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = p_user_id AND e.class_id = v_class
          AND e.group_id IS NULL AND e.kind = 'charge' AND e.period = v_month
          AND (e.voided_at IS NULL OR e.void_reason = 'payments reset')
      ) THEN
        PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END IF;
  RETURN v_changed;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_preview_activation_change(p_user_id uuid, p_group_id uuid, p_date date)
RETURNS TABLE(id uuid, period date, amount_uzs bigint, note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old date;
  v_class uuid;
  v_open date := date_trunc('month', public.bs_tashkent_today())::date;
  v_month date;
  v_last_closed date;
  v_month_end date;
  v_diff bigint;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  SELECT g.class_id INTO v_class FROM public.class_groups g WHERE g.id = p_group_id;
  SELECT COALESCE(m.activated_on, m.enrolled_on) INTO v_old
  FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id;
  IF v_old IS NULL OR p_date IS NULL OR v_old = p_date THEN
    RETURN;
  END IF;

  v_month := date_trunc('month', LEAST(v_old, p_date))::date;
  v_last_closed := LEAST(date_trunc('month', GREATEST(v_old, p_date))::date, (v_open - interval '1 month')::date);
  WHILE v_month <= v_last_closed LOOP
    IF EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_class AND e.group_id IS NULL
        AND e.kind = 'charge' AND e.period = v_month AND e.voided_at IS NULL
    ) THEN
      v_month_end := (v_month + interval '1 month')::date - 1;
      v_diff := COALESCE((SELECT s.amount FROM public._billing_group_span(p_user_id, p_group_id, v_month, p_date, v_month_end) s), 0)
              - COALESCE((SELECT s.amount FROM public._billing_group_span(p_user_id, p_group_id, v_month, v_old, v_month_end) s), 0);
      IF v_diff <> 0 THEN
        id := md5(p_group_id::text || v_month::text)::uuid;
        period := v_month;
        amount_uzs := abs(v_diff);
        note := CASE WHEN v_diff > 0 THEN 'Extra charge ' ELSE 'Credit ' END || to_char(v_month, 'FMMonth YYYY');
        RETURN NEXT;
      END IF;
    END IF;
    v_month := (v_month + interval '1 month')::date;
  END LOOP;

  RETURN QUERY
  SELECT e.id, e.period, e.amount_uzs, 'Reprice ' || to_char(e.period, 'FMMonth YYYY')
  FROM public.ledger_entries e
  WHERE e.user_id = p_user_id AND e.class_id = v_class AND e.group_id IS NULL
    AND e.kind = 'charge' AND e.source = 'auto' AND e.voided_at IS NULL
    AND e.period = v_open;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261031000004', 'billing_closed_months')
ON CONFLICT (version) DO NOTHING;
