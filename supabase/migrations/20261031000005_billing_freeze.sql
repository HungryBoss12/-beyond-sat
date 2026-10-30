-- A month a student spent entirely frozen in a class is never billed for that class,
-- even when a later backfill runs after the student comes back.

CREATE OR REPLACE FUNCTION public._bs_class_month_frozen(p_user_id uuid, p_class_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', p_month)::date AS first_day,
           ((date_trunc('month', p_month) + interval '1 month')::date - 1) AS last_day
  ),
  groups AS (
    SELECT m.group_id
    FROM public.class_group_memberships m
    WHERE m.user_id = p_user_id AND m.class_id = p_class_id
  )
  SELECT EXISTS (SELECT 1 FROM groups)
     AND NOT EXISTS (
       SELECT 1
       FROM groups g, bounds b
       WHERE COALESCE((
           SELECT ev.status::text
           FROM public.class_membership_events ev
           WHERE ev.user_id = p_user_id AND ev.group_id = g.group_id
             AND ev.kind = 'status' AND ev.effective_on <= b.first_day
           ORDER BY ev.effective_on DESC, ev.created_at DESC
           LIMIT 1
         ), '') <> 'frozen'
          OR EXISTS (
           SELECT 1
           FROM public.class_membership_events ev
           WHERE ev.user_id = p_user_id AND ev.group_id = g.group_id
             AND ev.kind = 'status' AND ev.status <> 'frozen'
             AND ev.effective_on > b.first_day AND ev.effective_on <= b.last_day
         )
     );
$$;

REVOKE ALL ON FUNCTION public._bs_class_month_frozen(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_charge_class_month(
  p_user_id uuid,
  p_class_id uuid,
  p_month date,
  p_source ledger_source
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_group uuid;
  v_part record;
  v_piece text;
  v_sum bigint := 0;
  v_labels text := '';
  v_ratio_rem int;
  v_ratio_tot int;
  v_mixed boolean := false;
  v_id uuid;
  v_activated date;
BEGIN
  SELECT min(COALESCE(m.activated_on, m.enrolled_on)) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  IF public._bs_class_month_frozen(p_user_id, p_class_id, v_month) THEN
    RETURN NULL;
  END IF;

  FOR v_group IN
    SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = p_class_id
  LOOP
    PERFORM public._bs_ensure_group_lessons(v_group, v_month);
    SELECT * INTO v_part FROM public.bs_subject_month_part(p_user_id, v_group, v_month);
    IF COALESCE(v_part.amount_uzs, 0) <= 0 THEN
      CONTINUE;
    END IF;
    v_sum := v_sum + v_part.amount_uzs;
    v_piece := v_part.group_name;
    IF v_part.remaining IS NOT NULL THEN
      v_piece := v_piece || ' ' || v_part.remaining || '/' || v_part.total;
      IF v_ratio_rem IS NULL THEN
        v_ratio_rem := v_part.remaining;
        v_ratio_tot := v_part.total;
      ELSIF v_ratio_rem IS DISTINCT FROM v_part.remaining
         OR v_ratio_tot IS DISTINCT FROM v_part.total THEN
        v_mixed := true;
      END IF;
    END IF;
    v_labels := CASE WHEN v_labels = '' THEN v_piece ELSE v_labels || ' + ' || v_piece END;
  END LOOP;

  v_sum := GREATEST(0, v_sum - COALESCE(public._bs_both_amount_cut(p_user_id, p_class_id, v_month), 0));
  IF v_sum <= 0 OR v_labels = '' THEN
    RETURN NULL;
  END IF;
  IF v_mixed THEN
    v_ratio_rem := NULL;
    v_ratio_tot := NULL;
  END IF;

  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
    prorate_lessons, prorate_total, created_by
  )
  VALUES (
    p_user_id, p_class_id, NULL, 'charge', v_sum, v_month,
    CASE WHEN p_source = 'manual' THEN public.bs_tashkent_today()
         WHEN v_ratio_rem IS NOT NULL THEN v_activated
         ELSE v_month END,
    public._billing_charge_note(v_month, v_labels, NULL, NULL),
    p_source, v_ratio_rem, v_ratio_tot, auth.uid()
  )
  ON CONFLICT (user_id, class_id, period) WHERE kind = 'charge' AND voided_at IS NULL AND group_id IS NULL
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261031000005', 'billing_freeze')
ON CONFLICT (version) DO NOTHING;
