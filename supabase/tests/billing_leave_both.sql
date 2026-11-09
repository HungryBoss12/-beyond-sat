-- Leaving both subjects of a class in the same month bills each one through its own leave date.
-- Runs inside one transaction and always rolls back by raising 'RESULT ...'.
-- Run: node scripts/run-sql-test.mjs supabase/tests/billing_leave_both.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_eng uuid;
  v_math uuid;
  v_s1 uuid := gen_random_uuid();
  v_s2 uuid := gen_random_uuid();
  v_s3 uuid := gen_random_uuid();
  v_note text;
  v_month date := date_trunc('month', public.bs_tashkent_today())::date;
  v_left date := date_trunc('month', public.bs_tashkent_today())::date + 8;
  v_start date := (date_trunc('month', public.bs_tashkent_today()) - interval '1 month')::date;
  v_eng_part bigint;
  v_math_part bigint;
  v_math_full bigint;
  v_got bigint;
  v_live int;
  v_out text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ test A') RETURNING id INTO v_a;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_a, 1200000, v_start);
  UPDATE public.class_groups SET name = 'ZZ A Eng', schedule_days = ARRAY[1,3,5]::smallint[]
  WHERE class_id = v_a AND subject = 'ebrw' RETURNING id INTO v_eng;
  UPDATE public.class_groups SET name = 'ZZ A Math', schedule_days = ARRAY[2,4,6]::smallint[]
  WHERE class_id = v_a AND subject = 'math' RETURNING id INTO v_math;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()
  FROM unnest(ARRAY[v_s1, v_s2, v_s3]) u;

  PERFORM public._bs_ensure_group_lessons(v_eng, v_month);
  PERFORM public._bs_ensure_group_lessons(v_math, v_month);
  SELECT amount INTO v_eng_part FROM public._billing_group_span(v_s1, v_eng, v_month, v_month, v_left);
  SELECT amount INTO v_math_part FROM public._billing_group_span(v_s1, v_math, v_month, v_month, v_left);

  -- 1. Both subjects leave on the same day, English first: each is billed through that day.
  PERFORM public.staff_add_group_member(v_eng, v_s1, 'active', v_start, v_start, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_s1, 'active', v_start, v_start, false, NULL);
  PERFORM public._billing_charge_class_month(v_s1, v_a, v_month, 'auto');
  PERFORM public.staff_remove_group_member(v_eng, v_s1, true, v_left);
  PERFORM public.staff_remove_group_member(v_math, v_s1, true, v_left);
  SELECT count(*)::int, COALESCE(sum(e.amount_uzs), 0) INTO v_live, v_got
  FROM public.ledger_entries e
  WHERE e.user_id = v_s1 AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_live = 1 AND v_got = v_eng_part + v_math_part AND v_math_part > 0
    THEN format(' | ok both left: %s = Eng %s + Math %s', v_got, v_eng_part, v_math_part)
    ELSE format(' | FAIL both left: %s live rows, %s charged, expected Eng %s + Math %s',
                v_live, v_got, v_eng_part, v_math_part) END;

  -- 2. Only English leaves: Math stays billed for the whole month.
  PERFORM public.staff_add_group_member(v_eng, v_s2, 'active', v_start, v_start, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_s2, 'active', v_start, v_start, false, NULL);
  PERFORM public._billing_charge_class_month(v_s2, v_a, v_month, 'auto');
  SELECT amount_uzs INTO v_math_full FROM public.bs_subject_month_part(v_s2, v_math, v_month);
  PERFORM public.staff_remove_group_member(v_eng, v_s2, true, v_left);
  SELECT COALESCE(sum(e.amount_uzs), 0) INTO v_got
  FROM public.ledger_entries e
  WHERE e.user_id = v_s2 AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_got = v_eng_part + v_math_full
    THEN format(' | ok one left: %s = Eng %s + Math %s', v_got, v_eng_part, v_math_full)
    ELSE format(' | FAIL one left: %s charged, expected Eng %s + Math %s', v_got, v_eng_part, v_math_full) END;

  -- 3. Math leaves on the 3rd, English on the 9th: each subject stops on its own date.
  SELECT amount INTO v_math_part FROM public._billing_group_span(v_s3, v_math, v_month, v_month, v_month + 2);
  PERFORM public.staff_add_group_member(v_eng, v_s3, 'active', v_start, v_start, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_s3, 'active', v_start, v_start, false, NULL);
  PERFORM public._billing_charge_class_month(v_s3, v_a, v_month, 'auto');
  PERFORM public.staff_remove_group_member(v_math, v_s3, true, v_month + 2);
  PERFORM public.staff_remove_group_member(v_eng, v_s3, true, v_left);
  SELECT count(*)::int, COALESCE(sum(e.amount_uzs), 0), max(e.note) INTO v_live, v_got, v_note
  FROM public.ledger_entries e
  WHERE e.user_id = v_s3 AND e.class_id = v_a AND e.period = v_month
    AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE
    WHEN v_live = 1 AND v_got = v_eng_part + v_math_part
     AND v_note LIKE '%ZZ A Math %/%' AND v_note LIKE '%ZZ A Eng %/%'
    THEN format(' | ok separate days: %s = Eng %s + Math %s (%s)', v_got, v_eng_part, v_math_part, v_note)
    ELSE format(' | FAIL separate days: %s live rows, %s charged, expected Eng %s + Math %s (%s)',
                v_live, v_got, v_eng_part, v_math_part, v_note) END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
