-- Charge every month from the real start (activation, or enrollment when
-- activation is empty) through this month. An open automatic charge whose
-- amount no longer matches that month's lesson share is rewritten. A month
-- cleared by "payments reset", and any manual charge, stays as it is.

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
    SELECT m.user_id,
           m.class_id,
           min(COALESCE(m.activated_on, m.enrolled_on)) AS started_on
    FROM public.class_group_memberships m
    WHERE m.status <> 'left'
      AND COALESCE(m.activated_on, m.enrolled_on) IS NOT NULL
      AND COALESCE(m.activated_on, m.enrolled_on) <= v_as_of
    GROUP BY m.user_id, m.class_id
  LOOP
    v_month := date_trunc('month', v_row.started_on)::date;
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

-- Rewrite automatic charges that disagree with the current month share.
DO $$
DECLARE
  v_row record;
  v_group uuid;
  v_part record;
  v_sum bigint;
  v_cut bigint;
BEGIN
  FOR v_row IN
    SELECT e.id, e.user_id, e.class_id, e.period, e.amount_uzs
    FROM public.ledger_entries e
    WHERE e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.group_id IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries r
        WHERE r.user_id = e.user_id
          AND r.class_id IS NOT DISTINCT FROM e.class_id
          AND r.period IS NOT DISTINCT FROM e.period
          AND r.kind = 'charge'
          AND r.void_reason = 'payments reset'
      )
  LOOP
    v_sum := 0;
    FOR v_group IN
      SELECT c.group_id
      FROM public.bs_counted_groups(v_row.user_id) c
      WHERE c.class_id = v_row.class_id
    LOOP
      PERFORM public._bs_ensure_group_lessons(v_group, v_row.period);
      SELECT * INTO v_part
      FROM public.bs_subject_month_part(v_row.user_id, v_group, v_row.period);
      IF COALESCE(v_part.amount_uzs, 0) > 0 THEN
        v_sum := v_sum + v_part.amount_uzs;
      END IF;
    END LOOP;

    v_cut := 0;
    SELECT COALESCE(d.value, 0) INTO v_cut
    FROM public.student_discounts d
    WHERE d.user_id = v_row.user_id
      AND d.subject = 'both'
      AND d.mode = 'amount'
      AND (d.ends_on IS NULL OR d.ends_on >= v_row.period)
    LIMIT 1;
    v_sum := GREATEST(0, v_sum - COALESCE(v_cut, 0));

    IF v_sum IS DISTINCT FROM v_row.amount_uzs THEN
      UPDATE public.ledger_entries
      SET voided_at = now(),
          voided_by = auth.uid(),
          void_reason = 'repriced'
      WHERE id = v_row.id
        AND voided_at IS NULL;
    END IF;
  END LOOP;
END $$;

SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261021000001', 'backfill_missing_month_charges')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
