-- Frozen groups stop counting toward fees; freezing keeps this month's charge
-- as it stands. A "both subjects" sum discount comes off once per student, in
-- the class they joined first, not once per class. Students can no longer
-- delete their own class membership. October charges voided after these
-- students left are restored.

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
  WHERE m.user_id = p_user_id
    AND m.status NOT IN ('left', 'frozen')
  ORDER BY m.class_id, g.subject, m.enrolled_on, m.joined_at, m.group_id;
$$;

CREATE OR REPLACE FUNCTION public._bs_both_amount_cut(p_user_id uuid, p_class_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT d.value
    FROM public.student_discounts d
    WHERE d.user_id = p_user_id
      AND d.subject = 'both'
      AND d.mode = 'amount'
      AND (d.ends_on IS NULL OR d.ends_on >= date_trunc('month', p_month)::date)
    LIMIT 1
  ), 0)
  WHERE p_class_id = (
    SELECT c.class_id
    FROM public.bs_counted_groups(p_user_id) c
    ORDER BY c.enrolled_on, c.joined_at, c.class_id
    LIMIT 1
  );
$$;

REVOKE ALL ON FUNCTION public._bs_both_amount_cut(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._bs_class_month_due(p_user_id uuid, p_class_id uuid, p_month date)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_part record;
  v_sum bigint := 0;
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
  RETURN GREATEST(0, v_sum - COALESCE(public._bs_both_amount_cut(p_user_id, p_class_id, p_month), 0));
END;
$$;

CREATE OR REPLACE FUNCTION public._billing_charge_class_month(p_user_id uuid, p_class_id uuid, p_month date, p_source ledger_source)
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

REVOKE ALL ON FUNCTION public._billing_charge_class_month(uuid, uuid, date, public.ledger_source) FROM PUBLIC, anon, authenticated;

-- Replaces this month's open auto charge in a class with an identical manual
-- one, so later repricing leaves it alone.
CREATE OR REPLACE FUNCTION public._billing_lock_open_month(p_user_id uuid, p_class_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ledger_entries%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.ledger_entries e
  WHERE e.user_id = p_user_id
    AND e.class_id = p_class_id
    AND e.group_id IS NULL
    AND e.kind = 'charge'
    AND e.source = 'auto'
    AND e.voided_at IS NULL
    AND e.period = date_trunc('month', public.bs_tashkent_today())::date
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  UPDATE public.ledger_entries
  SET voided_at = now(), voided_by = auth.uid(), void_reason = p_reason
  WHERE id = v_row.id;
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
    prorate_lessons, prorate_total, created_by
  )
  VALUES (
    v_row.user_id, v_row.class_id, NULL, 'charge', v_row.amount_uzs, v_row.period, v_row.occurred_on,
    v_row.note, 'manual', v_row.prorate_lessons, v_row.prorate_total, auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public._billing_lock_open_month(uuid, uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_group_member_status(p_group_id uuid, p_user_id uuid, p_status class_member_status)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old class_member_status;
  v_class uuid;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT m.status, m.class_id INTO v_old, v_class
  FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF p_status = 'frozen' AND v_old IS DISTINCT FROM 'frozen' THEN
    PERFORM public._billing_lock_open_month(p_user_id, v_class, 'frozen');
  END IF;
  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, NULL, NULL);
  IF v_old = 'frozen' AND p_status <> 'frozen' THEN
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
END;
$$;

DROP POLICY IF EXISTS "memberships delete own or staff" ON public.class_memberships;
CREATE POLICY "memberships delete staff" ON public.class_memberships
  FOR DELETE TO authenticated
  USING (public.bs_is_staff());

DO $$
DECLARE
  v_frozen record;
  v_pick record;
BEGIN
  FOR v_frozen IN
    SELECT DISTINCT m.user_id, m.class_id
    FROM public.class_group_memberships m
    WHERE m.status = 'frozen'
  LOOP
    PERFORM public._billing_lock_open_month(v_frozen.user_id, v_frozen.class_id, 'frozen');
  END LOOP;

  FOR v_pick IN
    SELECT *
    FROM (VALUES
      ('Boymirzayeva Dilnora', 'SAT 14', 511111::bigint),
      ('Boymirzayeva Dilnura', 'Pre-SAT', 425926::bigint),
      ('Xusanova Shahrizoda', 'SAT 13', 466667::bigint),
      ('Xolliyev Asliddin', 'SAT 12', 1066667::bigint)
    ) AS t(full_name, class_name, amount)
  LOOP
    INSERT INTO public.ledger_entries (
      user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
      prorate_lessons, prorate_total
    )
    SELECT e.user_id, e.class_id, NULL, 'charge', e.amount_uzs, e.period, e.occurred_on, e.note, 'manual',
           e.prorate_lessons, e.prorate_total
    FROM public.ledger_entries e
    JOIN public.profiles p ON p.id = e.user_id
    JOIN public.classes c ON c.id = e.class_id
    WHERE p.full_name = v_pick.full_name
      AND c.name = v_pick.class_name
      AND e.period = '2026-10-01'
      AND e.kind = 'charge'
      AND e.group_id IS NULL
      AND e.void_reason = 'repriced'
      AND e.amount_uzs = v_pick.amount
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries l
        WHERE l.user_id = e.user_id AND l.class_id = e.class_id AND l.period = e.period
          AND l.kind = 'charge' AND l.voided_at IS NULL AND l.group_id IS NULL
      )
    ORDER BY e.voided_at DESC
    LIMIT 1;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_remove_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_charge boolean DEFAULT true,
  p_left_on date DEFAULT NULL::date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_left date := COALESCE(p_left_on, public.bs_tashkent_today());
  v_month date;
  v_start date;
  v_from date;
  v_subject text;
  v_name text;
  v_base bigint;
  v_share bigint;
  v_mode text;
  v_value bigint;
  v_total int;
  v_attended int;
  v_amount bigint := 0;
  v_sum bigint := 0;
  v_cut bigint := 0;
  v_labels text := '';
  v_piece text;
  v_other uuid;
  v_part record;
  v_cursor date;
  v_end date := date_trunc('month', public.bs_tashkent_today())::date;
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT class_id, subject::text, name
    INTO v_class, v_subject, v_name
  FROM public.class_groups
  WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships
    WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;

  v_month := date_trunc('month', v_left)::date;

  -- A missing date is the previous client: keep a full charge for this month.
  -- The date fields always send p_left_on, and that path prorates through it.
  IF COALESCE(p_charge, true) AND p_left_on IS NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_class
        AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL
        AND e.period = v_month
    ) THEN
      PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
    END IF;
  ELSIF COALESCE(p_charge, true) THEN
    IF EXISTS (
      SELECT 1 FROM public.bs_counted_groups(p_user_id) c WHERE c.group_id = p_group_id
    ) THEN
      SELECT COALESCE(m.activated_on, m.enrolled_on)
        INTO v_start
      FROM public.class_group_memberships m
      WHERE m.group_id = p_group_id AND m.user_id = p_user_id;

      IF v_start IS NOT NULL AND v_month >= date_trunc('month', v_start)::date THEN
        PERFORM public._bs_ensure_group_lessons(p_group_id, v_month);
        v_base := COALESCE(
          public.bs_student_class_override(p_user_id, v_class, v_month),
          public.bs_class_fee_for_month(v_class, v_month),
          public.bs_class_fee_for_month(v_class, public.bs_tashkent_today())
        );
        v_share := public.bs_half_subject_amount(v_base, 1);
        IF v_share IS NOT NULL AND v_share > 0 THEN
          SELECT d.mode, d.value INTO v_mode, v_value
          FROM public.student_discounts d
          WHERE d.user_id = p_user_id
            AND d.subject = 'both'
            AND d.mode = 'percent'
            AND (d.ends_on IS NULL OR d.ends_on >= v_month)
          LIMIT 1;
          IF v_mode IS NULL THEN
            SELECT d.mode, d.value INTO v_mode, v_value
            FROM public.student_discounts d
            WHERE d.user_id = p_user_id
              AND d.subject = v_subject
              AND (d.ends_on IS NULL OR d.ends_on >= v_month)
            LIMIT 1;
          END IF;
          IF v_mode = 'percent' THEN
            v_share := GREATEST(0, v_share - (v_share * LEAST(v_value, 100)) / 100);
          ELSIF v_mode = 'amount' THEN
            v_share := GREATEST(0, v_share - v_value);
          END IF;

          v_from := GREATEST(v_month, v_start);
          SELECT count(*)::int,
                 count(*) FILTER (
                   WHERE l.lesson_date >= v_from AND l.lesson_date <= v_left
                 )::int
            INTO v_total, v_attended
          FROM public.class_lessons l
          WHERE l.group_id = p_group_id
            AND l.lesson_date >= v_month
            AND l.lesson_date < (v_month + interval '1 month')::date;

          IF COALESCE(v_total, 0) > 0 AND COALESCE(v_attended, 0) > 0 THEN
            IF v_attended < v_total THEN
              v_amount := round(v_share::numeric * v_attended / v_total)::bigint;
              v_piece := v_name || ' ' || v_attended || '/' || v_total;
            ELSE
              v_amount := v_share;
              v_piece := v_name;
            END IF;
            IF v_amount > 0 THEN
              v_sum := v_amount;
              v_labels := v_piece;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;

    FOR v_other IN
      SELECT c.group_id
      FROM public.bs_counted_groups(p_user_id) c
      WHERE c.class_id = v_class
        AND c.group_id <> p_group_id
    LOOP
      PERFORM public._bs_ensure_group_lessons(v_other, v_month);
      SELECT * INTO v_part FROM public.bs_subject_month_part(p_user_id, v_other, v_month);
      IF COALESCE(v_part.amount_uzs, 0) <= 0 THEN
        CONTINUE;
      END IF;
      v_sum := v_sum + v_part.amount_uzs;
      v_piece := v_part.group_name;
      IF v_part.remaining IS NOT NULL THEN
        v_piece := v_piece || ' ' || v_part.remaining || '/' || v_part.total;
      END IF;
      v_labels := CASE WHEN v_labels = '' THEN v_piece ELSE v_labels || ' + ' || v_piece END;
    END LOOP;

    v_cut := COALESCE(public._bs_both_amount_cut(p_user_id, v_class, v_month), 0);

    v_sum := GREATEST(0, v_sum - COALESCE(v_cut, 0));

    UPDATE public.ledger_entries e
    SET voided_at = now(),
        voided_by = auth.uid(),
        void_reason = 'left'
    WHERE e.user_id = p_user_id
      AND e.class_id = v_class
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.period > v_month
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries r
        WHERE r.user_id = e.user_id
          AND r.class_id IS NOT DISTINCT FROM e.class_id
          AND r.period IS NOT DISTINCT FROM e.period
          AND r.kind = 'charge'
          AND r.void_reason = 'payments reset'
      );

    IF NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = p_user_id
        AND e.class_id = v_class
        AND e.group_id IS NULL
        AND e.kind = 'charge'
        AND e.period = v_month
        AND e.void_reason = 'payments reset'
    ) THEN
      UPDATE public.ledger_entries e
      SET voided_at = now(),
          voided_by = auth.uid(),
          void_reason = 'left'
      WHERE e.user_id = p_user_id
        AND e.class_id = v_class
        AND e.group_id IS NULL
        AND e.kind = 'charge'
        AND e.source = 'auto'
        AND e.voided_at IS NULL
        AND e.period = v_month;

      IF v_sum > 0 AND v_labels <> '' AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = p_user_id
          AND e.class_id = v_class
          AND e.group_id IS NULL
          AND e.kind = 'charge'
          AND e.voided_at IS NULL
          AND e.period = v_month
      ) THEN
        INSERT INTO public.ledger_entries (
          user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
        )
        VALUES (
          p_user_id, v_class, NULL, 'charge', v_sum, v_month, v_left,
          public._billing_charge_note(v_month, v_labels, NULL, NULL),
          'manual', auth.uid()
        );
      END IF;
    END IF;
  END IF;

  PERFORM set_config('bs.left_on', v_left::text, true);
  DELETE FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  PERFORM set_config('bs.left_on', '', true);

  IF COALESCE(p_charge, true) AND p_left_on IS NOT NULL THEN
    v_cursor := (v_month + interval '1 month')::date;
    WHILE v_cursor <= v_end LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = p_user_id
          AND e.class_id = v_class
          AND e.group_id IS NULL
          AND e.kind = 'charge'
          AND e.period = v_cursor
          AND (
            e.voided_at IS NULL
            OR e.void_reason = 'payments reset'
          )
      ) THEN
        PERFORM public._billing_charge_class_month(p_user_id, v_class, v_cursor, 'auto');
      END IF;
      v_cursor := (v_cursor + interval '1 month')::date;
    END LOOP;
  ELSIF NOT COALESCE(p_charge, true) THEN
    PERFORM public._billing_reprice_open_month(p_user_id, v_class);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean, date) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261024000003', 'frozen_and_once_discount')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
