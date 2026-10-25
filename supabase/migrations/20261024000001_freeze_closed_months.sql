-- Billing only knows a student's current groups, so recomputing a finished
-- month after they leave a group or class shrinks or wipes what they owed.
-- The hourly job now reprices the current month only, and only for classes the
-- student is still in. A back-dated fee reprices its own months, and skips any
-- month whose group mix has changed since.

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

-- Voids and rewrites this month's auto charge in the classes the student is
-- still in. p_drop_class also clears this month in a class they just left
-- without a fee.
DROP FUNCTION IF EXISTS public._billing_reprice_open_month(uuid);
CREATE FUNCTION public._billing_reprice_open_month(p_user_id uuid, p_drop_class uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
  v_class uuid;
BEGIN
  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
  WHERE e.user_id = p_user_id
    AND e.kind = 'charge'
    AND e.source = 'auto'
    AND e.voided_at IS NULL
    AND e.group_id IS NULL
    AND e.period = v_month
    AND (
      e.class_id = p_drop_class
      OR e.class_id IN (SELECT c.class_id FROM public.bs_counted_groups(p_user_id) c)
    );
  FOR v_class IN
    SELECT DISTINCT c.class_id
    FROM public.bs_counted_groups(p_user_id) c
  LOOP
    PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_reprice_open_month(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- Reprices auto charges from p_from through this month after a fee change.
-- A finished month is left alone once the student has left a group in that
-- class on or after it, because their old groups are no longer on record.
CREATE OR REPLACE FUNCTION public._billing_reprice_class_from(p_user_id uuid, p_class_id uuid, p_from date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_end date := date_trunc('month', public.bs_tashkent_today())::date;
  v_row record;
  v_due bigint;
  v_done int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.bs_counted_groups(p_user_id) c WHERE c.class_id = p_class_id
  ) THEN
    RETURN 0;
  END IF;
  FOR v_row IN
    SELECT e.id, e.period, e.amount_uzs
    FROM public.ledger_entries e
    WHERE e.user_id = p_user_id
      AND e.class_id = p_class_id
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.period >= date_trunc('month', COALESCE(p_from, v_end))::date
      AND e.period <= v_end
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries r
        WHERE r.user_id = e.user_id
          AND r.class_id = e.class_id
          AND r.period = e.period
          AND r.kind = 'charge'
          AND r.void_reason = 'payments reset'
      )
      AND (
        e.period = v_end
        OR NOT EXISTS (
          SELECT 1 FROM public.class_membership_events ev
          WHERE ev.user_id = e.user_id
            AND ev.class_id = e.class_id
            AND ev.status = 'left'
            AND ev.effective_on >= e.period
        )
      )
    ORDER BY e.period
  LOOP
    v_due := public._bs_class_month_due(p_user_id, p_class_id, v_row.period);
    IF v_due IS DISTINCT FROM v_row.amount_uzs THEN
      UPDATE public.ledger_entries
      SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
      WHERE id = v_row.id AND voided_at IS NULL;
      PERFORM public._billing_charge_class_month(p_user_id, p_class_id, v_row.period, 'auto');
      v_done := v_done + 1;
    END IF;
  END LOOP;
  RETURN v_done;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_reprice_class_from(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- One student price per class. The latest save wins when two rows share a month.
CREATE OR REPLACE FUNCTION public.bs_student_class_override(p_user_id uuid, p_class_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT o.monthly_fee_uzs
  FROM public.student_fee_overrides o
  JOIN public.class_groups g ON g.id = o.group_id
  WHERE o.user_id = p_user_id
    AND g.class_id = p_class_id
    AND o.effective_from <= date_trunc('month', p_month)::date
  ORDER BY o.effective_from DESC, o.created_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bs_student_class_override(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_class_fee(p_class_id uuid, p_fee_uzs bigint, p_effective_from date DEFAULT NULL::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
  v_user uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 1000 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Fee must be between 1 000 and 100 000 000 UZS';
  END IF;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (p_class_id, p_fee_uzs, v_from, auth.uid())
  ON CONFLICT (class_id, effective_from) DO UPDATE
    SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs, created_by = EXCLUDED.created_by;
  FOR v_user IN
    SELECT DISTINCT m.user_id
    FROM public.class_group_memberships m
    WHERE m.class_id = p_class_id AND m.status <> 'left'
  LOOP
    PERFORM public._billing_reprice_class_from(v_user, p_class_id, v_from);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_student_fee(p_user_id uuid, p_class_id uuid, p_fee_uzs bigint, p_effective_from date DEFAULT NULL::date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
  v_group uuid;
  v_class uuid;
  v_saved integer := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 1000 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Fee must be between 1 000 and 100 000 000 UZS';
  END IF;
  FOR v_class IN
    SELECT DISTINCT g.class_id
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
      AND m.status <> 'left'
      AND (p_class_id IS NULL OR g.class_id = p_class_id)
  LOOP
    SELECT g.id INTO v_group
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
      AND g.class_id = v_class
      AND m.status <> 'left'
    ORDER BY CASE WHEN g.subject = 'math' THEN 0 ELSE 1 END
    LIMIT 1;
    IF v_group IS NULL THEN
      CONTINUE;
    END IF;
    INSERT INTO public.student_fee_overrides (user_id, group_id, monthly_fee_uzs, effective_from, created_by)
    VALUES (p_user_id, v_group, p_fee_uzs, v_from, auth.uid())
    ON CONFLICT (user_id, group_id, effective_from) DO UPDATE
      SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
          created_by = EXCLUDED.created_by,
          created_at = now();
    DELETE FROM public.student_fee_overrides o
    USING public.class_groups g
    WHERE g.id = o.group_id
      AND o.user_id = p_user_id
      AND g.class_id = v_class
      AND o.effective_from = v_from
      AND o.group_id <> v_group;
    PERFORM public._billing_reprice_class_from(p_user_id, v_class, v_from);
    v_saved := v_saved + 1;
  END LOOP;
  RETURN v_saved;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_fee_override(p_user_id uuid, p_group_id uuid, p_fee_uzs bigint, p_effective_from date DEFAULT NULL::date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
  v_class uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NOT NULL AND (p_fee_uzs < 0 OR p_fee_uzs > 100000000) THEN
    RAISE EXCEPTION 'Override must be between 0 and 100 000 000 UZS';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  INSERT INTO public.student_fee_overrides (user_id, group_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (p_user_id, p_group_id, p_fee_uzs, v_from, auth.uid())
  ON CONFLICT (user_id, group_id, effective_from) DO UPDATE
    SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
        created_by = EXCLUDED.created_by,
        created_at = now();
  DELETE FROM public.student_fee_overrides o
  USING public.class_groups g
  WHERE g.id = o.group_id
    AND o.user_id = p_user_id
    AND g.class_id = v_class
    AND o.effective_from = v_from
    AND o.group_id <> p_group_id;
  PERFORM public._billing_reprice_class_from(p_user_id, v_class, v_from);
END;
$$;

-- A move still clears this month in the class the student moved out of.
CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status class_member_status DEFAULT 'active'::class_member_status,
  p_enrolled_on date DEFAULT NULL::date,
  p_activated_on date DEFAULT NULL::date,
  p_move boolean DEFAULT false,
  p_from_class_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_existing public.class_group_memberships%ROWTYPE;
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_move AND NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;

  IF p_move THEN
    UPDATE public.ledger_entries e
    SET voided_at = now(), voided_by = auth.uid(), void_reason = 'moved'
    WHERE e.user_id = p_user_id
      AND e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.group_id IS NULL
      AND e.period = date_trunc('month', public.bs_tashkent_today())::date
      AND e.class_id IN (
        SELECT m.class_id FROM public.class_memberships m
        WHERE m.user_id = p_user_id
          AND m.class_id <> v_class
          AND (p_from_class_id IS NULL OR m.class_id = p_from_class_id)
      );
    DELETE FROM public.class_memberships
    WHERE user_id = p_user_id
      AND class_id <> v_class
      AND (p_from_class_id IS NULL OR class_id = p_from_class_id);
  END IF;

  SELECT * INTO v_existing FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF FOUND AND p_enrolled_on IS NOT NULL AND p_enrolled_on IS DISTINCT FROM v_existing.enrolled_on
     AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, p_enrolled_on, p_activated_on);
  IF p_move OR p_status <> 'left' THEN
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
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

    v_cut := 0;
    SELECT COALESCE(d.value, 0) INTO v_cut
    FROM public.student_discounts d
    WHERE d.user_id = p_user_id
      AND d.subject = 'both'
      AND d.mode = 'amount'
      AND (d.ends_on IS NULL OR d.ends_on >= v_month)
    LIMIT 1;
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

-- Restore September/October charges the hourly job voided after these students
-- left: Norxamidova (both months; English was removed with no fee, Maths with
-- the fee), Xursanov (September; October was removed with no fee), Xurramov
-- (both months; his balance had been written off to zero against them).
DO $$
DECLARE
  v_pick record;
BEGIN
  FOR v_pick IN
    SELECT *
    FROM (VALUES
      ('166db1b8-69ea-4331-8796-5b51f77c937d'::uuid, '2026-09-01'::date),
      ('166db1b8-69ea-4331-8796-5b51f77c937d'::uuid, '2026-10-01'::date),
      ('9626c1c5-d5d8-454b-b5a7-47d026606005'::uuid, '2026-09-01'::date),
      ('c7226ac7-0a6a-4657-a47a-1e54812dadd6'::uuid, '2026-09-01'::date),
      ('c7226ac7-0a6a-4657-a47a-1e54812dadd6'::uuid, '2026-10-01'::date)
    ) AS t(user_id, period)
  LOOP
    INSERT INTO public.ledger_entries (
      user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
      prorate_lessons, prorate_total
    )
    SELECT e.user_id, e.class_id, NULL, 'charge', e.amount_uzs, e.period, e.occurred_on, e.note, 'manual',
           e.prorate_lessons, e.prorate_total
    FROM public.ledger_entries e
    WHERE e.user_id = v_pick.user_id
      AND e.period = v_pick.period
      AND e.kind = 'charge'
      AND e.group_id IS NULL
      AND e.void_reason = 'repriced'
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

-- Hanifa's SAT 12 price was saved twice for October (Maths 600 000, English 0).
-- Her live charge was built from 600 000; keep that one.
DELETE FROM public.student_fee_overrides o
USING public.class_groups g
WHERE g.id = o.group_id
  AND o.user_id = '5c829992-705d-4a4d-b531-418d903e0d56'
  AND g.name = 'SAT 12 Eng'
  AND o.effective_from = '2026-10-01'
  AND o.monthly_fee_uzs = 0;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261024000001', 'freeze_closed_months')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
