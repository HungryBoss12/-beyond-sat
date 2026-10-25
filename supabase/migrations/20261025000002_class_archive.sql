-- Deleting a class is blocked once it has a payment, and a real delete would
-- also drop its groups, students, and lessons. Archive hides the class and
-- stops charging it from the next month. This month's charge stays.

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE OR REPLACE FUNCTION public.bs_counted_groups(p_user_id uuid)
RETURNS TABLE(group_id uuid, class_id uuid, subject class_subject, enrolled_on date, joined_at timestamp with time zone)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (m.class_id, g.subject)
    m.group_id, m.class_id, g.subject, m.enrolled_on, m.joined_at
  FROM public.class_group_memberships m
  JOIN public.class_groups g ON g.id = m.group_id
  JOIN public.classes c ON c.id = m.class_id
  WHERE m.user_id = p_user_id
    AND m.status NOT IN ('left', 'frozen')
    AND c.archived_at IS NULL
  ORDER BY m.class_id, g.subject, m.enrolled_on, m.joined_at, m.group_id;
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
      AND e.period = v_end
      AND EXISTS (
        SELECT 1 FROM public.bs_counted_groups(e.user_id) c
        WHERE c.class_id = e.class_id
      )
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
    JOIN public.classes c ON c.id = m.class_id
    WHERE m.status <> 'left'
      AND c.archived_at IS NULL
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

CREATE OR REPLACE FUNCTION public.admin_archive_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.classes
  SET archived_at = COALESCE(archived_at, now())
  WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_restore_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  UPDATE public.classes
  SET archived_at = NULL
  WHERE id = p_class_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archive_class(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_restore_class(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archive_class(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_restore_class(uuid) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261025000002', 'class_archive')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
