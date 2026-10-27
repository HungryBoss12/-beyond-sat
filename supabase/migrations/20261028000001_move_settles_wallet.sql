-- A move used to void the whole month on the old class. Keep the lessons
-- before the join date there, and let the new class start on the join date.

CREATE OR REPLACE FUNCTION public._billing_group_span(
  p_user_id uuid,
  p_group_id uuid,
  p_month date,
  p_first date,
  p_last date,
  OUT amount bigint,
  OUT label text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_class uuid;
  v_subject text;
  v_name text;
  v_base bigint;
  v_share bigint;
  v_mode text;
  v_value bigint;
  v_total int;
  v_attended int;
  v_first date;
  v_last date;
BEGIN
  amount := 0;
  label := '';
  v_first := GREATEST(v_month, COALESCE(p_first, v_month));
  v_last := LEAST((v_month + interval '1 month')::date - 1, COALESCE(p_last, v_month - 1));
  IF v_last < v_first THEN
    RETURN;
  END IF;

  SELECT g.class_id, g.subject::text, g.name
    INTO v_class, v_subject, v_name
  FROM public.class_groups g
  WHERE g.id = p_group_id;
  IF v_class IS NULL THEN
    RETURN;
  END IF;

  v_base := COALESCE(
    public.bs_student_class_override(p_user_id, v_class, v_month),
    public.bs_class_fee_for_month(v_class, v_month),
    public.bs_class_fee_for_month(v_class, public.bs_tashkent_today())
  );
  v_share := public.bs_half_subject_amount(v_base, 1);
  IF v_share IS NULL OR v_share <= 0 THEN
    RETURN;
  END IF;

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

  SELECT count(*)::int,
         count(*) FILTER (
           WHERE l.lesson_date >= v_first AND l.lesson_date <= v_last
         )::int
    INTO v_total, v_attended
  FROM public.class_lessons l
  WHERE l.group_id = p_group_id
    AND l.lesson_date >= v_month
    AND l.lesson_date < (v_month + interval '1 month')::date;

  IF COALESCE(v_total, 0) <= 0 OR COALESCE(v_attended, 0) <= 0 THEN
    RETURN;
  END IF;
  IF v_attended < v_total THEN
    amount := round(v_share::numeric * v_attended / v_total)::bigint;
    label := v_name || ' ' || v_attended || '/' || v_total;
  ELSE
    amount := v_share;
    label := v_name;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_group_span(uuid, uuid, date, date, date) FROM PUBLIC, anon, authenticated;

-- Lessons in p_class strictly before p_join stay on that class. Later automatic
-- months are voided. The join day belongs to the class the student is moving to.
CREATE OR REPLACE FUNCTION public._billing_close_class_before(
  p_user_id uuid,
  p_class_id uuid,
  p_join date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_join)::date;
  v_last date := p_join - 1;
  v_group record;
  v_span record;
  v_sum bigint := 0;
  v_labels text := '';
BEGIN
  IF p_join IS NULL THEN
    RETURN;
  END IF;

  FOR v_group IN
    SELECT m.group_id, COALESCE(m.activated_on, m.enrolled_on) AS started_on
    FROM public.class_group_memberships m
    WHERE m.user_id = p_user_id
      AND m.class_id = p_class_id
      AND m.status <> 'left'
  LOOP
    SELECT * INTO v_span
    FROM public._billing_group_span(
      p_user_id, v_group.group_id, v_month, v_group.started_on, v_last
    );
    IF COALESCE(v_span.amount, 0) <= 0 THEN
      CONTINUE;
    END IF;
    v_sum := v_sum + v_span.amount;
    v_labels := CASE WHEN v_labels = '' THEN v_span.label ELSE v_labels || ' + ' || v_span.label END;
  END LOOP;

  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'left'
  WHERE e.user_id = p_user_id
    AND e.class_id = p_class_id
    AND e.group_id IS NULL
    AND e.kind = 'charge'
    AND e.source = 'auto'
    AND e.voided_at IS NULL
    AND e.period >= v_month
    AND NOT EXISTS (
      SELECT 1 FROM public.ledger_entries r
      WHERE r.user_id = e.user_id
        AND r.class_id IS NOT DISTINCT FROM e.class_id
        AND r.period IS NOT DISTINCT FROM e.period
        AND r.kind = 'charge'
        AND r.void_reason = 'payments reset'
    );

  IF v_sum <= 0 OR v_labels = '' THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.ledger_entries e
    WHERE e.user_id = p_user_id
      AND e.class_id = p_class_id
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.period = v_month
      AND (
        e.voided_at IS NULL
        OR e.void_reason = 'payments reset'
      )
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
  )
  VALUES (
    p_user_id, p_class_id, NULL, 'charge', v_sum, v_month, v_last,
    public._billing_charge_note(v_month, v_labels, NULL, NULL),
    'manual', auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public._billing_close_class_before(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

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
  v_join date;
  v_old uuid;
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
    v_join := COALESCE(p_activated_on, p_enrolled_on, public.bs_tashkent_today());
    FOR v_old IN
      SELECT DISTINCT m.class_id
      FROM public.class_memberships m
      WHERE m.user_id = p_user_id
        AND m.class_id <> v_class
        AND (p_from_class_id IS NULL OR m.class_id = p_from_class_id)
    LOOP
      PERFORM public._billing_close_class_before(p_user_id, v_old, v_join);
    END LOOP;
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261028000001', 'move_settles_wallet')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
