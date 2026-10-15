-- A class month is still one charge. Each subject pays its own half,
-- prorated only by that sub-group's lessons in the month they joined.

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
  v_activated := LEAST(
    COALESCE(v_enrolled, v_activated),
    COALESCE(v_activated, v_enrolled)
  );
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
    v_amount := GREATEST(0, v_amount - (v_amount * LEAST(v_value, 100)) / 100);
  ELSIF v_mode = 'amount' THEN
    v_amount := GREATEST(0, v_amount - v_value);
  END IF;

  amount_uzs := v_amount;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_subject_month_part(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

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
  v_group uuid;
  v_part record;
  v_piece text;
  v_sum bigint := 0;
  v_labels text := '';
  v_ratio_rem int;
  v_ratio_tot int;
  v_mixed boolean := false;
  v_both_cut bigint := 0;
  v_id uuid;
  v_activated date;
BEGIN
  SELECT min(LEAST(
    COALESCE(m.enrolled_on, m.activated_on),
    COALESCE(m.activated_on, m.enrolled_on)
  )) INTO v_activated
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

  SELECT COALESCE(d.value, 0) INTO v_both_cut
  FROM public.student_discounts d
  WHERE d.user_id = p_user_id
    AND d.subject = 'both'
    AND d.mode = 'amount'
    AND (d.ends_on IS NULL OR d.ends_on >= v_month)
  LIMIT 1;
  v_sum := GREATEST(0, v_sum - COALESCE(v_both_cut, 0));
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
  v_part record;
  v_today date := public.bs_tashkent_today();
  v_fee bigint;
  v_override bigint;
  v_subjects int;
  v_show boolean;
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
    activated_on := LEAST(
      COALESCE(v_row.enrolled_on, v_row.activated_on),
      COALESCE(v_row.activated_on, v_row.enrolled_on)
    );
    override_fee_uzs := NULL;
    monthly_fee_uzs := NULL;
    join_amount_uzs := NULL;
    join_remaining := NULL;
    join_total := NULL;
    charged_uzs := 0;
    charge_count := 0;
    SELECT COUNT(DISTINCT c.subject)::int INTO v_subjects
    FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = v_row.class_id;
    v_show := EXISTS (
      SELECT 1 FROM public.bs_counted_groups(p_user_id) c WHERE c.group_id = v_row.group_id
    ) AND (
      (v_subjects >= 2 AND v_row.subject = 'math') OR v_subjects = 1
    );
    IF v_show THEN
      v_override := public.bs_student_class_override(p_user_id, v_row.class_id, v_today);
      v_fee := public.bs_half_subject_amount(
        COALESCE(v_override, public.bs_class_fee_for_month(v_row.class_id, v_today)),
        v_subjects
      );
      override_fee_uzs := v_override;
      monthly_fee_uzs := v_fee;
    END IF;
    IF activated_on IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.bs_counted_groups(p_user_id) c WHERE c.group_id = v_row.group_id
    ) THEN
      SELECT * INTO v_part
      FROM public.bs_subject_month_part(
        p_user_id, v_row.group_id, date_trunc('month', activated_on)::date
      );
      IF COALESCE(v_part.amount_uzs, 0) > 0 THEN
        join_amount_uzs := v_part.amount_uzs;
        join_remaining := v_part.remaining;
        join_total := v_part.total;
      END IF;
    END IF;
    IF v_row.class_rank = 1 THEN
      SELECT COALESCE(SUM(e.amount_uzs), 0)::bigint, count(*)::int INTO charged_uzs, charge_count
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_row.class_id
        AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

-- Drop lesson days that are no longer on the sub-group's schedule,
-- unless someone already marked attendance, a result, homework, or a level score.
CREATE OR REPLACE FUNCTION public._bs_prune_off_schedule_lessons(p_group_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_days smallint[];
BEGIN
  SELECT schedule_days INTO v_days FROM public.class_groups WHERE id = p_group_id;
  IF v_days IS NULL OR cardinality(v_days) = 0 THEN
    RETURN;
  END IF;
  DELETE FROM public.class_lessons l
  WHERE l.group_id = p_group_id
    AND NOT (EXTRACT(ISODOW FROM l.lesson_date)::smallint = ANY (v_days))
    AND NOT EXISTS (
      SELECT 1 FROM public.lesson_attendance a
      WHERE a.group_id = l.group_id AND a.lesson_date = l.lesson_date
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lesson_results r WHERE r.lesson_id = l.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.lesson_hw_marks m WHERE m.lesson_id = l.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.homework_assignments h WHERE h.lesson_id = l.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.student_level_scores s
      WHERE s.lesson_id = l.id AND s.voided_at IS NULL
    );
END;
$$;

REVOKE ALL ON FUNCTION public._bs_prune_off_schedule_lessons(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._bs_ensure_group_lessons(p_group_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.class_groups%ROWTYPE;
  v_day date;
  v_end date;
  v_added int := 0;
BEGIN
  SELECT * INTO v_group FROM public.class_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  PERFORM public._bs_prune_off_schedule_lessons(p_group_id);
  IF v_group.schedule_days IS NULL OR cardinality(v_group.schedule_days) = 0 THEN
    RETURN 0;
  END IF;
  v_day := date_trunc('month', p_month)::date;
  v_end := (v_day + interval '1 month' - interval '1 day')::date;
  WHILE v_day <= v_end LOOP
    IF EXTRACT(ISODOW FROM v_day)::smallint = ANY (v_group.schedule_days) THEN
      INSERT INTO public.class_lessons (group_id, class_id, subject, lesson_date, created_by)
      VALUES (v_group.id, v_group.class_id, v_group.subject, v_day, auth.uid())
      ON CONFLICT (group_id, lesson_date) DO NOTHING;
      IF FOUND THEN
        v_added := v_added + 1;
      END IF;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public.class_groups_prune_lessons()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.schedule_days IS NOT DISTINCT FROM OLD.schedule_days THEN
    RETURN NEW;
  END IF;
  PERFORM public._bs_prune_off_schedule_lessons(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_groups_prune_lessons ON public.class_groups;
CREATE TRIGGER class_groups_prune_lessons
  AFTER UPDATE OF schedule_days ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.class_groups_prune_lessons();

DO $$
DECLARE
  v_group uuid;
BEGIN
  FOR v_group IN SELECT id FROM public.class_groups LOOP
    PERFORM public._bs_prune_off_schedule_lessons(v_group);
  END LOOP;
END;
$$;

-- Rewrite open automatic charges. A month cleared by "payments reset" stays cleared.
UPDATE public.ledger_entries e
SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
WHERE e.kind = 'charge'
  AND e.source = 'auto'
  AND e.voided_at IS NULL
  AND e.group_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.ledger_entries r
    WHERE r.user_id = e.user_id
      AND r.class_id IS NOT DISTINCT FROM e.class_id
      AND r.period IS NOT DISTINCT FROM e.period
      AND r.kind = 'charge'
      AND r.void_reason = 'payments reset'
  );

SELECT public._billing_apply_recurring_fees(public.bs_tashkent_today());

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016000003', 'per_subject_join_fee')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
