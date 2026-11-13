-- Freezing or activating several sub-classes is one transaction.
-- A bad id rolls the whole call back. A second activate is a no-op.
-- Run: node scripts/run-sql-test.mjs supabase/migrations/20261113000002_freeze_many.sql supabase/tests/billing_freeze_many.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_eng uuid;
  v_math uuid;
  v_s uuid := gen_random_uuid();
  v_today date := public.bs_tashkent_today();
  v_eng_on date;
  v_math_on date;
  v_eng_status text;
  v_math_status text;
  v_eng_clear boolean;
  v_math_clear boolean;
  v_out text := '';
  v_err text;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ freeze many') RETURNING id INTO v_a;
  UPDATE public.class_groups SET name = 'ZZ F Eng' WHERE class_id = v_a AND subject = 'ebrw' RETURNING id INTO v_eng;
  UPDATE public.class_groups SET name = 'ZZ F Math' WHERE class_id = v_a AND subject = 'math' RETURNING id INTO v_math;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.staff_add_group_member(v_eng, v_s, 'active', v_today, v_today, false, NULL);
  PERFORM public.staff_add_group_member(v_math, v_s, 'active', v_today, v_today, false, NULL);

  PERFORM public.staff_freeze_group_members(ARRAY[v_eng, v_math], v_s, v_today, NULL, NULL);
  SELECT m.frozen_on, m.status INTO v_eng_on, v_eng_status
  FROM public.class_group_memberships m WHERE m.group_id = v_eng AND m.user_id = v_s;
  SELECT m.frozen_on, m.status INTO v_math_on, v_math_status
  FROM public.class_group_memberships m WHERE m.group_id = v_math AND m.user_id = v_s;
  v_out := v_out || CASE
    WHEN v_eng_on = v_today AND v_math_on = v_today AND v_eng_status = 'frozen' AND v_math_status = 'frozen'
    THEN ' | ok both frozen'
    ELSE format(' | FAIL both frozen: eng %s %s, math %s %s', v_eng_status, v_eng_on, v_math_status, v_math_on)
  END;

  BEGIN
    PERFORM public.staff_freeze_group_members(ARRAY[v_eng, gen_random_uuid()], v_s, v_today + 3, NULL, NULL);
    v_err := 'no error';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  SELECT m.frozen_on INTO v_eng_on FROM public.class_group_memberships m WHERE m.group_id = v_eng AND m.user_id = v_s;
  SELECT m.frozen_on INTO v_math_on FROM public.class_group_memberships m WHERE m.group_id = v_math AND m.user_id = v_s;
  v_out := v_out || CASE
    WHEN v_err <> 'no error' AND v_eng_on = v_today AND v_math_on = v_today
    THEN ' | ok bad id rolled back'
    ELSE format(' | FAIL rollback: err %s, eng %s, math %s', v_err, v_eng_on, v_math_on)
  END;

  PERFORM public.staff_activate_group_members(ARRAY[v_eng, v_math], v_s, NULL);
  PERFORM public.staff_activate_group_members(ARRAY[v_eng, v_math], v_s, NULL);
  SELECT m.status, m.frozen_on IS NULL INTO v_eng_status, v_eng_clear
  FROM public.class_group_memberships m WHERE m.group_id = v_eng AND m.user_id = v_s;
  SELECT m.status, m.frozen_on IS NULL INTO v_math_status, v_math_clear
  FROM public.class_group_memberships m WHERE m.group_id = v_math AND m.user_id = v_s;
  v_out := v_out || CASE
    WHEN v_eng_status = 'active' AND v_math_status = 'active' AND v_eng_clear AND v_math_clear
    THEN ' | ok activate twice'
    ELSE format(' | FAIL activate: eng %s cleared %s, math %s cleared %s', v_eng_status, v_eng_clear, v_math_status, v_math_clear)
  END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
