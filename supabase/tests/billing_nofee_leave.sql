-- A no-fee removal voids a manual participation charge.
-- Both subjects gone: the month nets to 0.
-- One subject gone: only the subject that remains is billed.
-- Runs inside one transaction and always rolls back by raising 'RESULT ...'.
-- Run: node scripts/run-sql-test.mjs supabase/migrations/20261113000001_nofee_voids_leave_charge.sql supabase/tests/billing_nofee_leave.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_eng uuid;
  v_math uuid;
  v_both uuid := gen_random_uuid();
  v_one uuid := gen_random_uuid();
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
  v_left date := date_trunc('month', public.bs_tashkent_today())::date + 6;
  v_start date := (date_trunc('month', public.bs_tashkent_today()) - interval '1 month')::date;
  v_math_full bigint;
  v_got bigint;
  v_live int;
  v_voided int;
  v_out text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ nofee') RETURNING id INTO v_a;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_a, 1200000, v_start);
  UPDATE public.class_groups SET name = 'ZZ N Eng', schedule_days = ARRAY[1,3,5]::smallint[]
  WHERE class_id = v_a AND subject = 'ebrw' RETURNING id INTO v_eng;
  UPDATE public.class_groups SET name = 'ZZ N Math', schedule_days = ARRAY[2,4,6]::smallint[]
  WHERE class_id = v_a AND subject = 'math' RETURNING id INTO v_math;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()
  FROM unnest(ARRAY[v_both, v_one]) u;

  PERFORM public._bs_ensure_group_lessons(v_eng, v_month);
  PERFORM public._bs_ensure_group_lessons(v_math, v_month);

  -- 1. An existing manual attendance charge is wiped when both subjects leave with no fee.
  PERFORM public.staff_add_group_member(v_eng, v_both, 'active', v_start, v_start, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_both, 'active', v_start, v_start, false, NULL);
  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = v_admin, void_reason = 'left'
  WHERE e.user_id = v_both AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
  ) VALUES (
    v_both, v_a, NULL, 'charge', 323077, v_month, v_left,
    'Course fee · attendance', 'manual', v_admin
  );
  PERFORM public.staff_remove_group_member(v_eng, v_both, false, v_left);
  PERFORM public.staff_remove_group_member(v_math, v_both, false, v_left);
  SELECT count(*)::int, COALESCE(sum(e.amount_uzs) FILTER (WHERE e.voided_at IS NULL), 0),
         count(*) FILTER (WHERE e.voided_at IS NOT NULL AND e.amount_uzs = 323077)::int
    INTO v_live, v_got, v_voided
  FROM public.ledger_entries e
  WHERE e.user_id = v_both AND e.class_id = v_a AND e.period = v_month AND e.kind = 'charge';
  v_out := v_out || CASE WHEN v_got = 0 AND v_voided >= 1
    THEN format(' | ok both no-fee: live %s, voided attendance rows %s', v_got, v_voided)
    ELSE format(' | FAIL both no-fee: %s live rows, %s live amount, %s voided attendance rows',
                v_live, v_got, v_voided) END;

  -- 2. Removing only English with no fee bills the subject that remains, not the old attendance charge.
  PERFORM public.staff_add_group_member(v_eng, v_one, 'active', v_start, v_start, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_one, 'active', v_start, v_start, false, NULL);
  UPDATE public.ledger_entries e
  SET voided_at = now(), voided_by = v_admin, void_reason = 'left'
  WHERE e.user_id = v_one AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
  ) VALUES (
    v_one, v_a, NULL, 'charge', 323077, v_month, v_left,
    'Course fee · attendance', 'manual', v_admin
  );
  PERFORM public.staff_remove_group_member(v_eng, v_one, false, v_left);
  SELECT amount_uzs INTO v_math_full FROM public.bs_subject_month_part(v_one, v_math, v_month);
  SELECT count(*)::int, COALESCE(sum(e.amount_uzs), 0) INTO v_live, v_got
  FROM public.ledger_entries e
  WHERE e.user_id = v_one AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_live = 1 AND v_got = v_math_full AND v_got > 0 AND v_got <> 323077
    THEN format(' | ok one no-fee: %s = Math %s', v_got, v_math_full)
    ELSE format(' | FAIL one no-fee: %s live rows, %s charged, expected Math %s',
                v_live, v_got, v_math_full) END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
