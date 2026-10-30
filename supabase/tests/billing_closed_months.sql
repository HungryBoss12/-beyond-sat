-- An activation date edit must not rebuild a closed month from today's placement.
-- Runs inside one transaction and always rolls back by raising 'RESULT ...'.
-- Run: npx supabase db query --linked -f supabase/tests/billing_closed_months.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_eng uuid;
  v_math uuid;
  v_s1 uuid := gen_random_uuid();
  v_s2 uuid := gen_random_uuid();
  v_sep date := date '2026-09-01';
  v_aug date := date '2026-08-01';
  v_sept_row uuid;
  v_sept bigint;
  v_eng_old bigint;
  v_eng_new bigint;
  v_net bigint;
  v_out text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ test A') RETURNING id INTO v_a;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_a, 1200000, date '2026-08-01');
  UPDATE public.class_groups SET name = 'ZZ A Eng', schedule_days = ARRAY[1,3,5]::smallint[]
  WHERE class_id = v_a AND subject = 'ebrw' RETURNING id INTO v_eng;
  UPDATE public.class_groups SET name = 'ZZ A Math', schedule_days = ARRAY[2,4,6]::smallint[]
  WHERE class_id = v_a AND subject = 'math' RETURNING id INTO v_math;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()
  FROM unnest(ARRAY[v_s1, v_s2]) u;

  -- 1. September keeps Math after Math is dropped and English's start moves by two days.
  PERFORM public.staff_add_group_member(v_eng, v_s1, 'active', date '2026-09-08', date '2026-09-08', false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_s1, 'active', date '2026-09-08', date '2026-09-08', false, NULL);
  PERFORM public._bs_ensure_group_lessons(v_eng, v_sep);
  PERFORM public._bs_ensure_group_lessons(v_math, v_sep);
  v_sept_row := public._billing_charge_class_month(v_s1, v_a, v_sep, 'auto');
  SELECT amount_uzs INTO v_sept FROM public.ledger_entries WHERE id = v_sept_row;
  SELECT amount_uzs INTO v_eng_old FROM public.bs_subject_month_part(v_s1, v_eng, v_sep);
  PERFORM public.staff_remove_group_member(v_math, v_s1, true, date '2026-10-05');
  PERFORM public.admin_set_activation_date(v_s1, v_eng, date '2026-09-10');
  SELECT amount INTO v_eng_new FROM public._billing_group_span(v_s1, v_eng, v_sep, date '2026-09-10', date '2026-09-30');
  SELECT COALESCE(sum(CASE WHEN e.kind = 'charge' THEN e.amount_uzs ELSE -e.amount_uzs END), 0) INTO v_net
  FROM public.ledger_entries e
  WHERE e.user_id = v_s1 AND e.class_id = v_a AND e.period = v_sep AND e.voided_at IS NULL;
  v_out := v_out || CASE
    WHEN v_net = v_sept + v_eng_new - v_eng_old
     AND EXISTS (SELECT 1 FROM public.ledger_entries WHERE id = v_sept_row AND voided_at IS NULL)
    THEN format(' | ok September kept Math: %s -> %s', v_sept, v_net)
    ELSE format(' | FAIL September was %s, now %s, expected %s', v_sept, v_net, v_sept + v_eng_new - v_eng_old) END;

  -- 2. Moving the start out of two closed months credits them back and bills October from the new date.
  PERFORM public.staff_add_group_member(v_eng, v_s2, 'active', date '2026-08-10', date '2026-08-10', false, NULL);
  PERFORM public._bs_ensure_group_lessons(v_eng, v_aug);
  PERFORM public._bs_ensure_group_lessons(v_eng, v_sep);
  PERFORM public._billing_charge_class_month(v_s2, v_a, v_aug, 'auto');
  PERFORM public._billing_charge_class_month(v_s2, v_a, v_sep, 'auto');
  PERFORM public.admin_set_activation_date(v_s2, v_eng, date '2026-10-06');
  SELECT COALESCE(sum(CASE WHEN e.kind = 'charge' THEN e.amount_uzs ELSE -e.amount_uzs END), 0) INTO v_net
  FROM public.ledger_entries e
  WHERE e.user_id = v_s2 AND e.class_id = v_a AND e.period IN (v_aug, v_sep) AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_net = 0
    THEN ' | ok August and September net to zero'
    ELSE format(' | FAIL August and September net %s', v_net) END;
  v_out := v_out || CASE WHEN EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_s2 AND e.class_id = v_a AND e.period = date '2026-10-01'
        AND e.kind = 'charge' AND e.voided_at IS NULL AND e.prorate_lessons IS NOT NULL)
    THEN ' | ok October prorated from the new date'
    ELSE ' | FAIL October not prorated' END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
