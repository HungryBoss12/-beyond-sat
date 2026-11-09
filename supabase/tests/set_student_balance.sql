-- Saving a negative balance adds one adjustment and leaves the student owing that amount.
-- Runs inside one transaction and always rolls back by raising 'RESULT ...'.
-- Run: npx supabase db query --linked -f supabase/tests/set_student_balance.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_s uuid := gen_random_uuid();
  v_bal bigint;
  v_rows int;
  v_out text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.admin_set_student_balance(v_s, -900000);
  v_bal := public.bs_student_balance(v_s);
  v_out := v_out || CASE WHEN v_bal = -900000 THEN ' | ok debt balance' ELSE ' | FAIL balance ' || COALESCE(v_bal::text, 'null') END;

  SELECT count(*) INTO v_rows
  FROM public.ledger_entries e
  WHERE e.user_id = v_s AND e.kind = 'charge' AND e.amount_uzs = 900000
    AND e.note = 'Balance set by admin' AND e.class_id IS NULL AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_rows = 1 THEN ' | ok one adjustment' ELSE ' | FAIL adjustments ' || v_rows END;

  PERFORM public.admin_set_student_balance(v_s, -900000);
  SELECT count(*) INTO v_rows
  FROM public.ledger_entries e
  WHERE e.user_id = v_s AND e.note = 'Balance set by admin' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN v_rows = 1 THEN ' | ok second save changes nothing' ELSE ' | FAIL rows after second save ' || v_rows END;

  PERFORM public.admin_set_student_balance(v_s, -100000);
  v_bal := public.bs_student_balance(v_s);
  v_out := v_out || CASE WHEN v_bal = -100000 THEN ' | ok raised balance' ELSE ' | FAIL raised ' || COALESCE(v_bal::text, 'null') END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
