-- Two groups per class (one Maths, one Eng), not two groups for the whole
-- student. The hourly fee run also rewrites an open automatic charge when
-- its amount no longer matches that month's lesson share.

CREATE OR REPLACE FUNCTION public.bs_counted_groups(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  subject public.class_subject,
  enrolled_on date,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.class_id, g.subject)
    m.group_id, m.class_id, g.subject, m.enrolled_on, m.joined_at
  FROM public.class_group_memberships m
  JOIN public.class_groups g ON g.id = m.group_id
  WHERE m.user_id = p_user_id
    AND m.status <> 'left'
  ORDER BY m.class_id, g.subject, m.enrolled_on, m.joined_at, m.group_id;
$$;

CREATE OR REPLACE FUNCTION public._bs_class_month_due(
  p_user_id uuid,
  p_class_id uuid,
  p_month date
)
RETURNS bigint
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_part record;
  v_sum bigint := 0;
  v_cut bigint := 0;
BEGIN
  FOR v_group IN
    SELECT c.group_id
    FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = p_class_id
  LOOP
    PERFORM public._bs_ensure_group_lessons(v_group, p_month);
    SELECT * INTO v_part
    FROM public.bs_subject_month_part(p_user_id, v_group, p_month);
    IF COALESCE(v_part.amount_uzs, 0) > 0 THEN
      v_sum := v_sum + v_part.amount_uzs;
    END IF;
  END LOOP;

  v_cut := 0;
  SELECT COALESCE(d.value, 0) INTO v_cut
  FROM public.student_discounts d
  WHERE d.user_id = p_user_id
    AND d.subject = 'both'
    AND d.mode = 'amount'
    AND (d.ends_on IS NULL OR d.ends_on >= date_trunc('month', p_month)::date)
  LIMIT 1;
  RETURN GREATEST(0, v_sum - COALESCE(v_cut, 0));
END;
$$;

REVOKE ALL ON FUNCTION public._bs_class_month_due(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

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
  v_due bigint;
  v_added int := 0;
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
    v_due := public._bs_class_month_due(v_row.user_id, v_row.class_id, v_row.period);
    IF v_due IS DISTINCT FROM v_row.amount_uzs THEN
      UPDATE public.ledger_entries
      SET voided_at = now(),
          voided_by = auth.uid(),
          void_reason = 'repriced'
      WHERE id = v_row.id
        AND voided_at IS NULL;
    END IF;
  END LOOP;

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

SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261022000001', 'counted_groups_per_class')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
