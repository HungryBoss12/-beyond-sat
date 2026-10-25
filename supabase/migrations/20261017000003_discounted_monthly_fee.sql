-- The monthly price includes the discount first. Expected then multiplies
-- that price by the lesson share. A Both amount is still removed once.

CREATE OR REPLACE FUNCTION public.bs_subject_month_part(
  p_user_id uuid,
  p_group_id uuid,
  p_month date
)
RETURNS TABLE (
  amount_uzs bigint,
  remaining integer,
  total integer,
  group_name text
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
  v_enrolled date;
  v_activated date;
  v_base bigint;
  v_share bigint;
  v_total int;
  v_remaining int;
  v_amount bigint;
  v_mode text;
  v_value bigint;
BEGIN
  amount_uzs := 0;
  remaining := NULL;
  total := NULL;
  group_name := NULL;

  SELECT g.class_id, g.subject::text, g.name
    INTO v_class, v_subject, v_name
  FROM public.class_groups g
  WHERE g.id = p_group_id;
  IF v_class IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;
  group_name := v_name;

  SELECT m.enrolled_on, m.activated_on
    INTO v_enrolled, v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id
    AND m.group_id = p_group_id
    AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);
  v_activated := COALESCE(v_activated, v_enrolled);
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NEXT;
    RETURN;
  END IF;

  v_base := COALESCE(
    public.bs_student_class_override(p_user_id, v_class, v_month),
    public.bs_class_fee_for_month(v_class, v_month),
    public.bs_class_fee_for_month(v_class, public.bs_tashkent_today())
  );
  v_share := public.bs_half_subject_amount(v_base, 1);
  IF v_share IS NULL OR v_share <= 0 THEN
    RETURN NEXT;
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

  IF v_month = date_trunc('month', v_activated)::date THEN
    SELECT count(*)::int,
           count(*) FILTER (WHERE l.lesson_date >= v_activated)::int
      INTO v_total, v_remaining
    FROM public.class_lessons l
    WHERE l.group_id = p_group_id
      AND l.lesson_date >= v_month
      AND l.lesson_date < (v_month + interval '1 month')::date;
    IF v_total > 0 AND v_remaining < v_total THEN
      v_amount := round(v_share::numeric * v_remaining / v_total)::bigint;
      remaining := v_remaining;
      total := v_total;
    ELSE
      v_amount := v_share;
    END IF;
  ELSE
    v_amount := v_share;
  END IF;

  amount_uzs := v_amount;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_subject_month_part(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- Full month after discount, before the Both amount is taken off once.
CREATE OR REPLACE FUNCTION public.bs_student_monthly_net(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum bigint := 0;
  v_group uuid;
  v_start date;
  v_part record;
  v_cut bigint := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_group, v_start IN
    SELECT c.group_id, COALESCE(m.activated_on, m.enrolled_on, public.bs_tashkent_today())
    FROM public.bs_counted_groups(p_user_id) c
    JOIN public.class_group_memberships m
      ON m.group_id = c.group_id AND m.user_id = p_user_id
  LOOP
    SELECT * INTO v_part
    FROM public.bs_subject_month_part(
      p_user_id,
      v_group,
      (date_trunc('month', v_start) + interval '1 month')::date
    );
    v_sum := v_sum + COALESCE(v_part.amount_uzs, 0);
  END LOOP;

  SELECT COALESCE(d.value, 0) INTO v_cut
  FROM public.student_discounts d
  WHERE d.user_id = p_user_id
    AND d.subject = 'both'
    AND d.mode = 'amount'
    AND (d.ends_on IS NULL OR d.ends_on >= public.bs_tashkent_today())
  LIMIT 1;

  RETURN GREATEST(0, v_sum - COALESCE(v_cut, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.bs_student_monthly_net(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_student_monthly_net(uuid) TO authenticated, service_role;

-- Same groups, list price, no discount. Used beside the discounted total.
CREATE OR REPLACE FUNCTION public.bs_student_monthly_gross(p_user_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sum bigint := 0;
  v_group uuid;
  v_class uuid;
  v_base bigint;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_group, v_class IN
    SELECT c.group_id, c.class_id
    FROM public.bs_counted_groups(p_user_id) c
  LOOP
    v_base := COALESCE(
      public.bs_student_class_override(p_user_id, v_class, public.bs_tashkent_today()),
      public.bs_class_fee_for_month(v_class, public.bs_tashkent_today())
    );
    v_sum := v_sum + COALESCE(public.bs_half_subject_amount(v_base, 1), 0);
  END LOOP;
  RETURN v_sum;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_student_monthly_gross(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_student_monthly_gross(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.admin_tuition_discount_totals()
RETURNS TABLE (without_discount bigint, with_discount bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid;
  v_without bigint := 0;
  v_with bigint := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_user IN
    SELECT DISTINCT m.user_id
    FROM public.class_group_memberships m
    WHERE m.status <> 'left'
  LOOP
    v_without := v_without + public.bs_student_monthly_gross(v_user);
    v_with := v_with + public.bs_student_monthly_net(v_user);
  END LOOP;
  without_discount := v_without;
  with_discount := v_with;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_tuition_discount_totals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_tuition_discount_totals() TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261017000003', 'discounted_monthly_fee')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
