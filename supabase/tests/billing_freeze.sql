-- A month spent entirely frozen is not billed when the student comes back.
-- Runs inside one transaction and always rolls back by raising 'RESULT ...'.
-- Run: npx supabase db query --linked -f supabase/tests/billing_freeze.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_a uuid;
  v_eng uuid;
  v_s uuid := gen_random_uuid();
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

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  -- Active from August 1, frozen from August 25, back on October 31.
  PERFORM public.staff_add_group_member(v_eng, v_s, 'active', date '2026-08-01', date '2026-08-01', false, NULL);
  PERFORM public._billing_charge_class_month(v_s, v_a, date '2026-08-01', 'auto');
  UPDATE public.class_group_memberships SET status = 'frozen' WHERE user_id = v_s AND group_id = v_eng;
  UPDATE public.class_membership_events SET effective_on = date '2026-08-25'
  WHERE user_id = v_s AND group_id = v_eng AND status = 'frozen';
  PERFORM public.staff_set_group_member_status(v_eng, v_s, 'active');
  PERFORM public._billing_apply_recurring_fees(public.bs_tashkent_today());

  v_out := v_out || CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_s AND e.period = date '2026-09-01' AND e.kind = 'charge' AND e.voided_at IS NULL)
    THEN ' | ok frozen September not billed'
    ELSE ' | FAIL frozen September was billed' END;
  v_out := v_out || CASE WHEN EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL)
    THEN ' | ok October billed after thaw'
    ELSE ' | FAIL October not billed' END;
  v_out := v_out || CASE WHEN EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_s AND e.period = date '2026-08-01' AND e.kind = 'charge' AND e.voided_at IS NULL)
    THEN ' | ok August kept'
    ELSE ' | FAIL August lost' END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
