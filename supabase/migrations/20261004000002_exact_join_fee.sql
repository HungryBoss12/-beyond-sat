-- Join-month charge is the nearest so'm, not the nearest 1 000.
-- 1 200 000 is the monthly fee for every class except SAT 10.
-- A student override replaces that class fee when one is saved.

CREATE OR REPLACE FUNCTION public.bs_class_join_month_charge(
  p_class_id uuid,
  p_activated_on date,
  p_fee bigint
)
RETURNS TABLE (amount_uzs bigint, remaining integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_activated_on)::date;
  v_group uuid;
BEGIN
  FOR v_group IN SELECT id FROM public.class_groups WHERE class_id = p_class_id LOOP
    PERFORM public._bs_ensure_group_lessons(v_group, v_start);
  END LOOP;
  SELECT count(*)::int,
         count(*) FILTER (WHERE l.lesson_date >= p_activated_on)::int
  INTO total, remaining
  FROM public.class_lessons l
  JOIN public.class_groups g ON g.id = l.group_id
  WHERE g.class_id = p_class_id
    AND l.lesson_date >= v_start
    AND l.lesson_date < (v_start + interval '1 month')::date;
  IF p_fee IS NULL OR p_fee <= 0 THEN
    amount_uzs := 0;
  ELSIF total = 0 THEN
    amount_uzs := p_fee;
  ELSE
    amount_uzs := round(p_fee::numeric * remaining / NULLIF(total, 0))::bigint;
  END IF;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.bs_join_month_charge(p_group_id uuid, p_activated_on date, p_fee bigint)
RETURNS TABLE (amount_uzs bigint, remaining integer, total integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start date := date_trunc('month', p_activated_on)::date;
  v_end date := (date_trunc('month', p_activated_on) + interval '1 month' - interval '1 day')::date;
BEGIN
  PERFORM public._bs_ensure_group_lessons(p_group_id, v_start);
  SELECT count(*)::int, count(*) FILTER (WHERE l.lesson_date >= p_activated_on)::int
  INTO total, remaining
  FROM public.class_lessons l
  WHERE l.group_id = p_group_id AND l.lesson_date BETWEEN v_start AND v_end;
  IF p_fee IS NULL OR p_fee <= 0 THEN
    amount_uzs := 0;
  ELSIF total = 0 THEN
    amount_uzs := p_fee;
  ELSE
    amount_uzs := round(p_fee::numeric * remaining / NULLIF(total, 0))::bigint;
  END IF;
  RETURN NEXT;
END;
$$;

-- Latest per-student price for a class, if an admin saved one.
CREATE OR REPLACE FUNCTION public.bs_student_class_override(
  p_user_id uuid,
  p_class_id uuid,
  p_month date
)
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
  ORDER BY o.effective_from DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.bs_student_class_override(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

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
BEGIN
  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left';
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  FOR v_group IN
    SELECT group_id FROM public.class_group_memberships
    WHERE user_id = p_user_id AND class_id = p_class_id AND status <> 'left'
  LOOP
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  v_override := public.bs_student_class_override(p_user_id, p_class_id, v_month);
  v_fee := COALESCE(v_override, public.bs_class_fee_for_month(p_class_id, v_month));
  IF v_fee IS NULL OR v_fee <= 0 THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_name FROM public.classes WHERE id = p_class_id;
  v_amount := v_fee;
  IF v_month = date_trunc('month', v_activated)::date THEN
    SELECT j.amount_uzs, j.remaining, j.total INTO v_amount, v_remaining, v_total
    FROM public.bs_class_join_month_charge(p_class_id, v_activated, v_fee) j;
    IF v_total = 0 OR v_remaining = v_total THEN
      v_remaining := NULL;
      v_total := NULL;
    END IF;
  END IF;
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

CREATE OR REPLACE FUNCTION public.admin_set_student_fee(
  p_user_id uuid,
  p_class_id uuid,
  p_fee_uzs bigint,
  p_effective_from date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from date := date_trunc('month', COALESCE(p_effective_from, public.bs_tashkent_today()))::date;
  v_group uuid;
  v_class uuid;
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
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_fee(uuid, uuid, bigint, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_fee(uuid, uuid, bigint, date) TO authenticated;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS billing_note text;

CREATE OR REPLACE FUNCTION public.admin_set_billing_note(p_user_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  UPDATE public.students
  SET billing_note = NULLIF(btrim(p_note), '')
  WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_billing_note(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_billing_note(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_billing_note(p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN public.bs_is_admin() THEN (
      SELECT s.billing_note FROM public.students s WHERE s.user_id = p_user_id
    )
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.admin_billing_note(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_note(uuid) TO authenticated;

-- Show the student's price (override, otherwise the class fee) on one row per class.
CREATE OR REPLACE FUNCTION public.admin_student_billing(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  group_name text,
  subject public.class_subject,
  status public.class_member_status,
  enrolled_on date,
  activated_on date,
  monthly_fee_uzs bigint,
  override_fee_uzs bigint,
  join_amount_uzs bigint,
  join_remaining integer,
  join_total integer,
  charged_uzs bigint,
  charge_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_join record;
  v_today date := public.bs_tashkent_today();
  v_fee bigint;
  v_override bigint;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_row IN
    SELECT m.*, g.name AS gname,
      row_number() OVER (
        PARTITION BY m.class_id
        ORDER BY CASE WHEN g.subject = 'math' THEN 0 ELSE 1 END, g.name
      ) AS class_rank
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
    ORDER BY g.name, g.subject
  LOOP
    group_id := v_row.group_id;
    class_id := v_row.class_id;
    group_name := v_row.gname;
    subject := v_row.subject;
    status := v_row.status;
    enrolled_on := v_row.enrolled_on;
    activated_on := v_row.activated_on;
    override_fee_uzs := NULL;
    monthly_fee_uzs := NULL;
    join_amount_uzs := NULL;
    join_remaining := NULL;
    join_total := NULL;
    charged_uzs := 0;
    charge_count := 0;
    IF v_row.class_rank = 1 THEN
      v_override := public.bs_student_class_override(p_user_id, v_row.class_id, v_today);
      v_fee := COALESCE(v_override, public.bs_class_fee_for_month(v_row.class_id, v_today));
      override_fee_uzs := v_override;
      monthly_fee_uzs := v_fee;
      IF v_row.activated_on IS NOT NULL AND v_fee IS NOT NULL THEN
        SELECT j.* INTO v_join
        FROM public.bs_class_join_month_charge(v_row.class_id, v_row.activated_on, v_fee) j;
        join_amount_uzs := v_join.amount_uzs;
        join_remaining := v_join.remaining;
        join_total := v_join.total;
      END IF;
      SELECT COALESCE(SUM(e.amount_uzs), 0)::bigint, count(*)::int INTO charged_uzs, charge_count
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_row.class_id
        AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
SELECT c.id, 1200000, date_trunc('month', public.bs_tashkent_today())::date
FROM public.classes c
WHERE c.name !~* '^sat[[:space:]]*10$'
ON CONFLICT (class_id, effective_from) DO UPDATE
  SET monthly_fee_uzs = EXCLUDED.monthly_fee_uzs;
