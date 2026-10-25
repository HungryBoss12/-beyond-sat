-- Removing a student stores the day they stopped. The fee path replaces
-- that month's open automatic charge with lessons from their start through
-- that day, and voids later automatic months. The no-fee path only stores
-- the date and clears the open month.

CREATE OR REPLACE FUNCTION public.class_group_memberships_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left date := public.bs_tashkent_today();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.enrolled_on, auth.uid());
    PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    INSERT INTO public.chat_thread_members (thread_id, user_id)
    SELECT t.id, NEW.user_id
    FROM public.chat_threads t
    WHERE t.class_id = NEW.class_id AND t.kind = 'subject_group' AND t.subject = NEW.subject
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, public.bs_tashkent_today(), auth.uid());
      PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    END IF;
    IF NEW.activated_on IS DISTINCT FROM OLD.activated_on AND NEW.activated_on IS NOT NULL THEN
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by, kind)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.activated_on, auth.uid(), 'activation');
    END IF;
    RETURN NEW;
  ELSE
    BEGIN
      IF NULLIF(current_setting('bs.left_on', true), '') IS NOT NULL THEN
        v_left := NULLIF(current_setting('bs.left_on', true), '')::date;
      END IF;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        v_left := public.bs_tashkent_today();
    END;
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    SELECT OLD.user_id, OLD.class_id, OLD.group_id, 'left', v_left, auth.uid()
    WHERE EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = OLD.group_id)
      AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = OLD.class_id);
    PERFORM public.bs_sync_parent_membership(OLD.class_id, OLD.user_id);
    DELETE FROM public.chat_thread_members m
    USING public.chat_threads t
    WHERE m.thread_id = t.id
      AND m.user_id = OLD.user_id
      AND t.class_id = OLD.class_id
      AND t.kind = 'subject_group'
      AND t.subject = OLD.subject
      AND NOT public._bs_user_is_staff(OLD.user_id);
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT 'active',
  p_enrolled_on date DEFAULT NULL,
  p_activated_on date DEFAULT NULL,
  p_move boolean DEFAULT false,
  p_from_class_id uuid DEFAULT NULL
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

DROP FUNCTION IF EXISTS public.staff_remove_group_member(uuid, uuid, boolean, date);
DROP FUNCTION IF EXISTS public.staff_remove_group_member(uuid, uuid, boolean);
DROP FUNCTION IF EXISTS public.staff_remove_group_member(uuid, uuid);

CREATE FUNCTION public.staff_remove_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_charge boolean DEFAULT true,
  p_left_on date DEFAULT NULL
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
  ELSE
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean, date) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261022000005', 'leave_date')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
