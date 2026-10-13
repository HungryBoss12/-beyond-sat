-- Admin reset: void every open ledger row so balances return to zero.
-- A charge voided as 'payments reset' is not billed again for that month.

CREATE OR REPLACE FUNCTION public.admin_reset_all_payments()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.ledger_entries
  SET voided_at = now(),
      voided_by = auth.uid(),
      void_reason = 'payments reset'
  WHERE voided_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_reset_all_payments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_reset_all_payments() TO authenticated, service_role;

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
          AND (
            e.voided_at IS NULL
            OR e.void_reason = 'payments reset'
          )
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261014000003', 'reset_all_payments')
ON CONFLICT (version) DO NOTHING;
