-- Move and duplicate-subject billing scenarios. Runs inside one transaction and always
-- rolls back by raising 'RESULT ...'. A line containing FAIL is a failed assertion.
-- Run: npx supabase db query --linked -f supabase/tests/billing_moves.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_b uuid;
  v_a_eng uuid;
  v_a_math uuid;
  v_b_eng uuid;
  v_b_math uuid;
  v_s1 uuid := gen_random_uuid();
  v_s2 uuid := gen_random_uuid();
  v_s3 uuid := gen_random_uuid();
  v_out text := '';
  v_err text;
  v_act date;
  v_expect bigint;
  v_got bigint;
  v_oct date := date '2026-10-01';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ test A') RETURNING id INTO v_a;
  INSERT INTO public.classes (name) VALUES ('ZZ test B') RETURNING id INTO v_b;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_a, 1200000, date '2026-08-01'), (v_b, 1200000, date '2026-08-01');
  UPDATE public.class_groups SET name = 'ZZ A Eng', schedule_days = ARRAY[1,3,5]::smallint[]
  WHERE class_id = v_a AND subject = 'ebrw' RETURNING id INTO v_a_eng;
  UPDATE public.class_groups SET name = 'ZZ A Math', schedule_days = ARRAY[2,4,6]::smallint[]
  WHERE class_id = v_a AND subject = 'math' RETURNING id INTO v_a_math;
  UPDATE public.class_groups SET name = 'ZZ B Eng', schedule_days = ARRAY[1,3,5]::smallint[]
  WHERE class_id = v_b AND subject = 'ebrw' RETURNING id INTO v_b_eng;
  UPDATE public.class_groups SET name = 'ZZ B Math', schedule_days = ARRAY[2,4,6]::smallint[]
  WHERE class_id = v_b AND subject = 'math' RETURNING id INTO v_b_math;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  SELECT u, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
         u::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()
  FROM unnest(ARRAY[v_s1, v_s2, v_s3]) u;

  -- 1. The same subject cannot be added in a second class without a move.
  PERFORM public.staff_add_group_member(v_a_math, v_s1, 'active', v_oct, v_oct, false, NULL);
  BEGIN
    PERFORM public.staff_add_group_member(v_b_math, v_s1, 'active', date '2026-10-20', date '2026-10-20', false, NULL);
    v_out := v_out || ' | FAIL duplicate subject was allowed';
  EXCEPTION WHEN OTHERS THEN
    v_out := v_out || ' | ok duplicate subject rejected: ' || SQLERRM;
  END;

  -- 2. Moving into a group the student already sits in starts that group on the move date.
  -- Rows like this exist from before the one-subject rule, so build one directly.
  PERFORM public.staff_add_group_member(v_a_math, v_s2, 'active', v_oct, v_oct, false, NULL);
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'class_group_memberships_one_subject') THEN
    ALTER TABLE public.class_group_memberships DISABLE TRIGGER class_group_memberships_one_subject;
  END IF;
  INSERT INTO public.class_group_memberships (group_id, user_id, status, enrolled_on, activated_on)
  VALUES (v_b_math, v_s2, 'active', v_oct, v_oct);
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'class_group_memberships_one_subject') THEN
    ALTER TABLE public.class_group_memberships ENABLE TRIGGER class_group_memberships_one_subject;
  END IF;
  PERFORM public.staff_add_group_member(v_b_math, v_s2, 'active', date '2026-10-25', date '2026-10-25', true, v_a);
  SELECT m.activated_on INTO v_act FROM public.class_group_memberships m
  WHERE m.user_id = v_s2 AND m.group_id = v_b_math;
  v_out := v_out || CASE WHEN v_act = date '2026-10-25'
    THEN ' | ok existing group restarts on move date'
    ELSE ' | FAIL existing group kept activation ' || COALESCE(v_act::text, 'null') END;

  -- 3. Moving a second subject in keeps the first subject's own start.
  PERFORM public.staff_add_group_member(v_a_math, v_s3, 'active', v_oct, v_oct, false, NULL);
  PERFORM public.staff_add_group_member(v_b_eng, v_s3, 'active', date '2026-10-10', date '2026-10-10', false, NULL);
  PERFORM public.staff_add_group_member(v_b_math, v_s3, 'active', date '2026-10-25', date '2026-10-25', true, v_a);
  SELECT COALESCE(sum(p.amount_uzs), 0) INTO v_expect
  FROM (VALUES (v_b_eng), (v_b_math)) g(id)
  CROSS JOIN LATERAL public.bs_subject_month_part(v_s3, g.id, v_oct) p;
  SELECT e.amount_uzs INTO v_got FROM public.ledger_entries e
  WHERE e.user_id = v_s3 AND e.class_id = v_b AND e.period = v_oct
    AND e.kind = 'charge' AND e.voided_at IS NULL AND e.group_id IS NULL;
  SELECT m.activated_on INTO v_act FROM public.class_group_memberships m
  WHERE m.user_id = v_s3 AND m.group_id = v_b_eng;
  v_out := v_out || CASE WHEN v_act = date '2026-10-10' AND v_got = v_expect AND v_expect > 0
    THEN ' | ok second subject move keeps Eng from 10th (' || v_got || ')'
    ELSE format(' | FAIL second subject move: Eng starts %s, charged %s, expected %s', v_act, v_got, v_expect) END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
