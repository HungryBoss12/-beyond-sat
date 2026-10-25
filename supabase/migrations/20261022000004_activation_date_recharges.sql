-- Changing the activation date voided the open charge, then skipped the
-- replacement whenever an older "repriced" void sat on that month. Only a
-- live charge or a payments-reset void should block the new charge.

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

  SELECT min(COALESCE(m.activated_on, m.enrolled_on)) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = v_class AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);

  IF v_activated IS NOT NULL THEN
    v_month := date_trunc('month', v_activated)::date;
    v_end := date_trunc('month', public.bs_tashkent_today())::date;
    WHILE v_month <= v_end LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = p_user_id AND e.class_id = v_class
          AND e.group_id IS NULL AND e.kind = 'charge' AND e.period = v_month
          AND (
            e.voided_at IS NULL
            OR e.void_reason = 'payments reset'
          )
      ) THEN
        PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END IF;
  RETURN v_voided;
END;
$$;

-- Students already left at 0 by this bug get the missing months back.
SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261022000004', 'activation_date_recharges')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
