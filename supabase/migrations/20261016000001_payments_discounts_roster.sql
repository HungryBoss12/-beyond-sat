-- Edit a payment by voiding it and writing the corrected row.
-- Fee notes name the sub-groups. Discounts follow the subject across a move.
-- Removing a student can keep or waive this month's participation fee.

CREATE OR REPLACE FUNCTION public.admin_edit_payment(
  p_id uuid,
  p_amount_uzs bigint,
  p_method public.pay_method,
  p_occurred_on date,
  p_note text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ledger_entries%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row FROM public.ledger_entries WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_row.voided_at IS NOT NULL OR v_row.kind <> 'payment' THEN
    RAISE EXCEPTION 'Payment not found or already voided';
  END IF;
  PERFORM public._billing_check_amount(p_amount_uzs);
  IF p_occurred_on IS NULL OR p_occurred_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  UPDATE public.ledger_entries
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'payment corrected'
  WHERE id = p_id;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, method, occurred_on, note, source, created_by
  )
  VALUES (
    v_row.user_id, 'payment', p_amount_uzs, COALESCE(p_method, 'cash'),
    p_occurred_on, left(COALESCE(NULLIF(btrim(p_note), ''), 'Payment'), 80),
    'manual', auth.uid()
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_edit_payment(uuid, bigint, public.pay_method, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_edit_payment(uuid, bigint, public.pay_method, date, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bs_charge_group_label(p_user_id uuid, p_class_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT NULLIF(string_agg(g.name, ' + ' ORDER BY g.subject, g.name), '')
      FROM public.class_group_memberships m
      JOIN public.class_groups g ON g.id = m.group_id
      WHERE m.user_id = p_user_id
        AND m.class_id = p_class_id
        AND m.status <> 'left'
    ),
    (SELECT c.name FROM public.classes c WHERE c.id = p_class_id),
    'Class'
  );
$$;

REVOKE ALL ON FUNCTION public.bs_charge_group_label(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_charge_class_month(
  p_user_id uuid,
  p_class_id uuid,
  p_month date,
  p_source public.ledger_source
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_name text;
  v_activated date;
  v_fee bigint;
  v_override bigint;
  v_amount bigint;
  v_remaining int;
  v_total int;
  v_active boolean := false;
  v_group uuid;
  v_id uuid;
  v_subjects int;
BEGIN
  SELECT min(m.activated_on) INTO v_activated
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
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  IF NOT v_active THEN
    v_active := v_activated <= (v_month + interval '1 month' - interval '1 day')::date;
  END IF;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(DISTINCT c.subject)::int INTO v_subjects
  FROM public.bs_counted_groups(p_user_id) c
  WHERE c.class_id = p_class_id;
  v_override := public.bs_student_class_override(p_user_id, p_class_id, v_month);
  v_fee := public.bs_half_subject_amount(
    COALESCE(
      v_override,
      public.bs_class_fee_for_month(p_class_id, v_month),
      public.bs_class_fee_for_month(p_class_id, public.bs_tashkent_today())
    ),
    v_subjects
  );
  IF v_fee IS NULL OR v_fee <= 0 THEN
    RETURN NULL;
  END IF;
  v_name := public.bs_charge_group_label(p_user_id, p_class_id);
  v_amount := v_fee;
  IF v_month = date_trunc('month', v_activated)::date THEN
    SELECT j.amount_uzs, j.remaining, j.total INTO v_amount, v_remaining, v_total
    FROM public.bs_class_join_month_charge(p_class_id, v_activated, v_fee) j;
    IF v_total = 0 OR v_remaining = v_total THEN
      v_remaining := NULL;
      v_total := NULL;
    END IF;
  END IF;
  v_amount := public.bs_apply_discount(p_user_id, p_class_id, v_amount, v_month);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
    prorate_lessons, prorate_total, created_by
  )
  VALUES (
    p_user_id, p_class_id, NULL, 'charge', v_amount, v_month,
    CASE WHEN p_source = 'manual' THEN public.bs_tashkent_today()
         WHEN v_remaining IS NOT NULL THEN v_activated
         ELSE v_month END,
    public._billing_charge_note(v_month, v_name, v_remaining, v_total),
    p_source, v_remaining, v_total, auth.uid()
  )
  ON CONFLICT (user_id, class_id, period) WHERE kind = 'charge' AND voided_at IS NULL AND group_id IS NULL
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Discounts belong to a subject, so a move to another group of that subject keeps them.
ALTER TABLE public.student_discounts ADD COLUMN IF NOT EXISTS subject text;

UPDATE public.student_discounts d
SET subject = COALESCE(src.subject, 'both')
FROM (
  SELECT d2.id,
    CASE
      WHEN COUNT(DISTINCT g.subject) FILTER (WHERE m.user_id IS NOT NULL AND m.status <> 'left') >= 2 THEN 'both'
      ELSE MIN(g.subject::text) FILTER (WHERE m.user_id IS NOT NULL AND m.status <> 'left')
    END AS subject
  FROM public.student_discounts d2
  LEFT JOIN public.class_group_memberships m
    ON m.user_id = d2.user_id AND m.class_id = d2.class_id
  LEFT JOIN public.class_groups g ON g.id = m.group_id
  GROUP BY d2.id
) src
WHERE d.id = src.id AND d.subject IS NULL;

UPDATE public.student_discounts SET subject = 'both' WHERE subject IS NULL;

DELETE FROM public.student_discounts d
WHERE d.id IN (
  SELECT id FROM (
    SELECT id, row_number() OVER (PARTITION BY user_id, subject ORDER BY created_at DESC, id DESC) AS n
    FROM public.student_discounts
  ) ranked
  WHERE n > 1
);

ALTER TABLE public.student_discounts ALTER COLUMN class_id DROP NOT NULL;
ALTER TABLE public.student_discounts DROP CONSTRAINT IF EXISTS student_discounts_user_id_class_id_key;
ALTER TABLE public.student_discounts DROP CONSTRAINT IF EXISTS student_discounts_subject_ok;
ALTER TABLE public.student_discounts
  ADD CONSTRAINT student_discounts_subject_ok CHECK (subject IN ('ebrw', 'math', 'both'));
ALTER TABLE public.student_discounts ALTER COLUMN subject SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS student_discounts_user_subject_uidx
  ON public.student_discounts (user_id, subject);

CREATE OR REPLACE FUNCTION public.bs_apply_discount(
  p_user_id uuid,
  p_class_id uuid,
  p_amount bigint,
  p_on date
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subjects text[];
  v_mode text;
  v_value bigint;
  v_count int;
  v_index int := 0;
  v_subject text;
  v_portion bigint;
  v_total bigint := 0;
  v_one_mode text;
  v_one_value bigint;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN COALESCE(p_amount, 0);
  END IF;
  SELECT COALESCE(array_agg(DISTINCT c.subject::text), ARRAY[]::text[])
    INTO v_subjects
  FROM public.bs_counted_groups(p_user_id) c
  WHERE c.class_id = p_class_id;
  v_count := COALESCE(array_length(v_subjects, 1), 0);
  IF v_count = 0 THEN
    RETURN p_amount;
  END IF;

  SELECT d.mode, d.value INTO v_mode, v_value
  FROM public.student_discounts d
  WHERE d.user_id = p_user_id
    AND d.subject = 'both'
    AND (d.ends_on IS NULL OR d.ends_on >= p_on)
  LIMIT 1;
  IF v_mode = 'percent' THEN
    RETURN GREATEST(0, p_amount - (p_amount * LEAST(v_value, 100)) / 100);
  END IF;
  IF v_mode = 'amount' THEN
    RETURN GREATEST(0, p_amount - v_value);
  END IF;

  FOREACH v_subject IN ARRAY v_subjects LOOP
    v_index := v_index + 1;
    IF v_index < v_count THEN
      v_portion := p_amount / v_count;
    ELSE
      v_portion := p_amount - (p_amount / v_count) * (v_count - 1);
    END IF;
    v_one_mode := NULL;
    v_one_value := NULL;
    SELECT d.mode, d.value INTO v_one_mode, v_one_value
    FROM public.student_discounts d
    WHERE d.user_id = p_user_id
      AND d.subject = v_subject
      AND (d.ends_on IS NULL OR d.ends_on >= p_on)
    LIMIT 1;
    IF v_one_mode = 'percent' THEN
      v_portion := GREATEST(0, v_portion - (v_portion * LEAST(v_one_value, 100)) / 100);
    ELSIF v_one_mode = 'amount' THEN
      v_portion := GREATEST(0, v_portion - v_one_value);
    END IF;
    v_total := v_total + v_portion;
  END LOOP;
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION public._billing_reprice_open_month(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
  v_class uuid;
BEGIN
  UPDATE public.ledger_entries
  SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
  WHERE user_id = p_user_id
    AND kind = 'charge'
    AND source = 'auto'
    AND voided_at IS NULL
    AND group_id IS NULL
    AND period = v_month;
  FOR v_class IN
    SELECT DISTINCT c.class_id
    FROM public.bs_counted_groups(p_user_id) c
  LOOP
    PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_reprice_open_month(uuid) FROM PUBLIC, anon, authenticated;

DROP FUNCTION IF EXISTS public.admin_set_student_discount(uuid, uuid, text, bigint, date);
CREATE FUNCTION public.admin_set_student_discount(
  p_user_id uuid,
  p_subject text,
  p_mode text,
  p_value bigint,
  p_ends_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_can_edit_discount(p_user_id) OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_subject NOT IN ('ebrw', 'math', 'both') THEN
    RAISE EXCEPTION 'Pick English, Maths, or both';
  END IF;
  IF p_mode NOT IN ('percent', 'amount') THEN
    RAISE EXCEPTION 'Discount must be a percent or a sum';
  END IF;
  IF p_mode = 'percent' AND (p_value < 1 OR p_value > 100) THEN
    RAISE EXCEPTION 'Percent must be between 1 and 100';
  END IF;
  IF p_mode = 'amount' AND (p_value < 1000 OR p_value > 100000000) THEN
    RAISE EXCEPTION 'Amount must be between 1 000 and 100 000 000 UZS';
  END IF;
  INSERT INTO public.student_discounts (user_id, subject, mode, value, ends_on, created_by)
  VALUES (p_user_id, p_subject, p_mode, p_value, p_ends_on, auth.uid())
  ON CONFLICT (user_id, subject) DO UPDATE
    SET mode = EXCLUDED.mode,
        value = EXCLUDED.value,
        ends_on = EXCLUDED.ends_on,
        created_by = EXCLUDED.created_by,
        created_at = now();
  PERFORM public._billing_reprice_open_month(p_user_id);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_clear_student_discount(uuid, uuid);
CREATE FUNCTION public.admin_clear_student_discount(p_user_id uuid, p_subject text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_can_edit_discount(p_user_id) OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM public.student_discounts
  WHERE user_id = p_user_id AND subject = p_subject;
  PERFORM public._billing_reprice_open_month(p_user_id);
END;
$$;

DROP FUNCTION IF EXISTS public.admin_list_student_discounts();
CREATE FUNCTION public.admin_list_student_discounts()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  subject text,
  mode text,
  value bigint,
  ends_on date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
    )
  ) OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT d.id,
    d.user_id,
    COALESCE(NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), NULLIF(btrim(p.full_name), ''), 'Student'),
    d.subject,
    d.mode,
    d.value,
    d.ends_on
  FROM public.student_discounts d
  JOIN public.profiles p ON p.id = d.user_id
  WHERE public.bs_is_admin() OR public.bs_teaches_student(d.user_id)
  ORDER BY 3, d.subject;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_discount(uuid, text, text, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_student_discount(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_student_discounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_discount(uuid, text, text, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_student_discount(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_student_discounts() TO authenticated;

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
  IF p_activated_on IS NOT NULL AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
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

DROP FUNCTION IF EXISTS public.staff_remove_group_member(uuid, uuid);
CREATE FUNCTION public.staff_remove_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_charge boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF COALESCE(p_charge, true) AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries e
    WHERE e.user_id = p_user_id AND e.class_id = v_class
      AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL
      AND e.period = v_month
  ) THEN
    PERFORM public._billing_charge_class_month(p_user_id, v_class, v_month, 'auto');
  END IF;
  DELETE FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT COALESCE(p_charge, true) THEN
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_remove_group_member(uuid, uuid, boolean) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.admin_payments_summary();
CREATE FUNCTION public.admin_payments_summary()
RETURNS TABLE (
  total_owed bigint,
  debtors integer,
  credits bigint,
  creditors integer,
  settled integer,
  priced_groups integer,
  active_groups integer,
  min_fee bigint,
  max_fee bigint,
  paid_this_month bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
BEGIN
  IF NOT public.bs_is_admin() OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT m.user_id FROM public.class_memberships m
    UNION
    SELECT e.user_id FROM public.ledger_entries e
  ),
  b AS (
    SELECT public.bs_student_balance(pp.user_id) AS bal FROM people pp
  ),
  fees AS (
    SELECT f.monthly_fee_uzs
    FROM public.admin_class_fees() f
    WHERE f.active
  )
  SELECT
    COALESCE(SUM(-b.bal) FILTER (WHERE b.bal < 0), 0)::bigint,
    COUNT(*) FILTER (WHERE b.bal < 0)::int,
    COALESCE(SUM(b.bal) FILTER (WHERE b.bal > 0), 0)::bigint,
    COUNT(*) FILTER (WHERE b.bal > 0)::int,
    COUNT(*) FILTER (WHERE b.bal = 0)::int,
    (SELECT COUNT(*) FROM fees WHERE fees.monthly_fee_uzs IS NOT NULL)::int,
    (SELECT COUNT(*) FROM fees)::int,
    (SELECT MIN(fees.monthly_fee_uzs) FROM fees),
    (SELECT MAX(fees.monthly_fee_uzs) FROM fees),
    COALESCE((
      SELECT SUM(e.amount_uzs)
      FROM public.ledger_entries e
      WHERE e.kind = 'payment'
        AND e.voided_at IS NULL
        AND e.occurred_on >= v_month
        AND e.occurred_on < (v_month + interval '1 month')::date
    ), 0)::bigint
  FROM b;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_payments_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_payments_summary() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016000001', 'payments_discounts_roster')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
