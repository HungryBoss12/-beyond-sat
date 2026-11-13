-- A held account is removed after 14 days only when the balance is zero.
-- Run: node scripts/run-sql-test.mjs supabase/migrations/20261114000001_student_basket.sql supabase/tests/student_basket.sql
DO $$
DECLARE
  v_s uuid := gen_random_uuid();
  v_class uuid;
  v_month date := date_trunc('month', current_date)::date;
  v_alive boolean;
  v_out text := '';
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_s, v_s::text || '@billing-test.invalid', 'ZZ basket')
  ON CONFLICT (id) DO NOTHING;
  UPDATE public.profiles SET deleted_at = now() - interval '15 days' WHERE id = v_s;

  INSERT INTO public.classes (name) VALUES ('ZZ basket') RETURNING id INTO v_class;
  INSERT INTO public.ledger_entries (user_id, class_id, kind, amount_uzs, period, occurred_on, note, source)
  VALUES (v_s, v_class, 'charge', 100000, v_month, current_date, 'basket test', 'manual');
  PERFORM public.purge_settled_student_accounts();
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_s) INTO v_alive;
  v_out := v_out || CASE WHEN v_alive
    THEN ' | ok debt stays'
    ELSE ' | FAIL debt was deleted' END;

  INSERT INTO public.ledger_entries (user_id, kind, amount_uzs, occurred_on, note, source)
  VALUES (v_s, 'payment', 100000, current_date, 'basket test', 'manual');
  PERFORM public.purge_settled_student_accounts();
  SELECT EXISTS (SELECT 1 FROM auth.users WHERE id = v_s) INTO v_alive;
  v_out := v_out || CASE WHEN NOT v_alive
    THEN ' | ok zero balance removed'
    ELSE ' | FAIL zero balance stayed' END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
