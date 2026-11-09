-- Leaving a second subject in the same month bills it through its own leave date.
-- The month's charge is adjusted in place: the leaving group's full-month part comes out
-- and its share through the leave date goes in. A subject that left earlier keeps the
-- share already written, because its membership row is gone and cannot be rebuilt.

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
  v_share bigint;
  v_total int;
  v_attended int;
  v_amount bigint := 0;
  v_leaving_piece text := '';
  v_sum bigint := 0;
  v_cut bigint := 0;
  v_labels text := '';
  v_piece text;
  v_other uuid;
  v_part record;
  v_cursor date;
  v_end date := date_trunc('month', public.bs_tashkent_today())::date;
  v_prev public.ledger_entries%ROWTYPE;
  v_billed bigint;
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
        v_share := public._bs_subject_share(p_user_id, v_class, v_subject, v_month);
        IF v_share > 0 THEN
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
              v_leaving_piece := v_name || ' ' || v_attended || '/' || v_total;
            ELSE
              v_amount := v_share;
              v_leaving_piece := v_name;
            END IF;
          END IF;
        END IF;
      END IF;
    END IF;
    v_amount := GREATEST(0, v_amount);

    SELECT * INTO v_prev
    FROM public.ledger_entries e
    WHERE e.user_id = p_user_id
      AND e.class_id = v_class
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.voided_at IS NULL
      AND e.period = v_month
    LIMIT 1;

    IF v_prev.id IS NOT NULL
       AND NOT public._bs_class_month_has_freeze(p_user_id, v_class, v_month) THEN
      SELECT p.amount_uzs INTO v_billed
      FROM public.bs_subject_month_part(p_user_id, p_group_id, v_month) p;
      v_sum := GREATEST(0, v_prev.amount_uzs - COALESCE(v_billed, 0) + v_amount);
      SELECT COALESCE(string_agg(piece, ' + ' ORDER BY ord), '')
        INTO v_labels
      FROM unnest(string_to_array(
             regexp_replace(
               regexp_replace(COALESCE(v_prev.note, ''), '^Course fee · [^·]+ · ', ''),
               ' · \d+/\d+ lessons$', ''),
             ' + ')) WITH ORDINALITY AS t(piece, ord)
      WHERE piece <> ''
        AND piece <> v_name
        AND left(piece, length(v_name) + 1) <> v_name || ' ';
      IF v_amount > 0 THEN
        v_labels := CASE WHEN v_labels = '' THEN v_leaving_piece ELSE v_labels || ' + ' || v_leaving_piece END;
      END IF;
    ELSE
      IF v_amount > 0 THEN
        v_sum := v_amount;
        v_labels := v_leaving_piece;
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
    END IF;

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
        AND e.voided_at IS NULL
        AND e.period = v_month
        AND (e.source = 'auto' OR e.id = v_prev.id);

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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261109000002', 'leave_bills_each_subject')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
