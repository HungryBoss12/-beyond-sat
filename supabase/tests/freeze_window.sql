-- Freeze window: a full frozen month drops its automatic charge, a mid-month start
-- keeps only the lessons before it, a skipped return date does not thaw, and both
-- a return date and Activate now resume billing. Rolls back by raising 'RESULT ...'.
-- Run: npx supabase db query --linked -f supabase/tests/freeze_window.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_class uuid;
  v_eng uuid;
  v_today date := public.bs_tashkent_today();
  v_this date := date_trunc('month', v_today)::date;
  v_prev date := (date_trunc('month', v_today) - interval '1 month')::date;
  v_hand date := (date_trunc('month', v_today) - interval '2 month')::date;
  v_full uuid := gen_random_uuid();
  v_mid uuid := gen_random_uuid();
  v_skip uuid := gen_random_uuid();
  v_back uuid := gen_random_uuid();
  v_hand_user uuid := gen_random_uuid();
  v_trial uuid := gen_random_uuid();
  v_later uuid := gen_random_uuid();
  v_return date;
  v_before bigint;
  v_after bigint;
  v_due bigint;
  v_out text := '';
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object(
      'sub', v_admin,
      'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password', 'timestamp', extract(epoch FROM now())::bigint))
    )::text, true);

  INSERT INTO public.classes (name) VALUES ('ZZ freeze window') RETURNING id INTO v_class;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_class, 1200000, date '2024-01-01');
  UPDATE public.class_groups
  SET name = 'ZZ freeze Eng', schedule_days = ARRAY[1, 3, 5]::smallint[]
  WHERE class_id = v_class AND subject = 'ebrw'
  RETURNING id INTO v_eng;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_full, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_full::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_mid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_mid::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_skip, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_skip::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_back, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_back::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_hand_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_hand_user::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_trial, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_trial::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_later, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_later::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.staff_add_group_member(v_eng, v_full, 'active', v_hand, v_hand, false, NULL);
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source
  )
  VALUES (v_full, v_class, NULL, 'charge', 111000, v_hand, v_hand, 'Entered by hand', 'manual');
  PERFORM public._billing_charge_class_month(v_full, v_class, v_prev, 'auto');
  PERFORM public.staff_freeze_group_member(v_eng, v_full, v_prev, NULL);

  v_out := v_out || CASE WHEN (
      SELECT m.status = 'frozen' AND m.resumes_on IS NULL FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_full
    ) THEN ' | ok full freeze stays open-ended' ELSE ' | FAIL full freeze status' END;
  v_out := v_out || CASE WHEN EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_full AND e.period = v_hand AND e.kind = 'charge'
        AND e.voided_at IS NULL AND e.source = 'manual' AND e.amount_uzs = 111000
    ) THEN ' | ok hand charge kept' ELSE ' | FAIL hand charge rewritten' END;
  v_out := v_out || CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_full AND e.period = v_prev AND e.kind = 'charge' AND e.voided_at IS NULL
    ) AND EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_full AND e.period = v_prev AND e.kind = 'charge'
        AND e.source = 'auto' AND e.void_reason = 'frozen'
    ) THEN ' | ok full month voided' ELSE ' | FAIL full month still billed' END;

  PERFORM public.staff_add_group_member(v_eng, v_mid, 'active', v_hand, v_hand, false, NULL);
  PERFORM public._billing_charge_class_month(v_mid, v_class, v_prev, 'auto');
  SELECT e.amount_uzs INTO v_before
  FROM public.ledger_entries e
  WHERE e.user_id = v_mid AND e.period = v_prev AND e.kind = 'charge' AND e.voided_at IS NULL;
  PERFORM public.staff_freeze_group_member(v_eng, v_mid, v_prev + 14, NULL);
  SELECT e.amount_uzs INTO v_after
  FROM public.ledger_entries e
  WHERE e.user_id = v_mid AND e.period = v_prev AND e.kind = 'charge' AND e.voided_at IS NULL;
  SELECT b.amount_uzs INTO v_due FROM public._bs_class_month_billable(v_mid, v_class, v_prev) b;

  v_out := v_out || CASE
    WHEN v_before > 0 AND v_after > 0 AND v_after < v_before AND v_after = v_due
      THEN ' | ok mid-month prorated'
    ELSE ' | FAIL mid-month before=' || COALESCE(v_before::text, 'null')
      || ' after=' || COALESCE(v_after::text, 'null')
      || ' due=' || COALESCE(v_due::text, 'null')
  END;

  PERFORM public.staff_add_group_member(v_eng, v_skip, 'active', v_hand, v_hand, false, NULL);
  PERFORM public.staff_freeze_group_member(v_eng, v_skip, v_this, NULL);
  PERFORM public._billing_apply_due_freezes(v_today + 40);
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'frozen' AND m.resumes_on IS NULL AND m.frozen_on = v_this
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_skip
    ) THEN ' | ok skipped return stays frozen' ELSE ' | FAIL skipped return thawed' END;

  v_return := v_today + 1;
  IF date_trunc('month', v_return)::date <> v_this THEN
    v_return := v_today;
  END IF;
  PERFORM public.staff_add_group_member(v_eng, v_back, 'active', v_hand, v_hand, false, NULL);
  PERFORM public.staff_freeze_group_member(v_eng, v_back, v_prev, v_return);
  IF v_return > v_today THEN
    v_out := v_out || CASE WHEN (
        SELECT m.status = 'frozen' FROM public.class_group_memberships m
        WHERE m.group_id = v_eng AND m.user_id = v_back
      ) THEN ' | ok return date still ahead' ELSE ' | FAIL return date thawed early' END;
    PERFORM public._billing_apply_due_freezes(v_today);
    v_out := v_out || CASE WHEN (
        SELECT m.status = 'frozen' FROM public.class_group_memberships m
        WHERE m.group_id = v_eng AND m.user_id = v_back
      ) THEN ' | ok job waits for the return date' ELSE ' | FAIL job thawed early' END;
  END IF;
  PERFORM public._billing_apply_due_freezes(v_return);
  SELECT b.amount_uzs INTO v_due FROM public._bs_class_month_billable(v_back, v_class, v_this) b;
  SELECT e.amount_uzs INTO v_after
  FROM public.ledger_entries e
  WHERE e.user_id = v_back AND e.period = v_this AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'active' AND m.frozen_on IS NULL AND m.resumes_on IS NULL
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_back
    ) AND v_after IS NOT DISTINCT FROM NULLIF(v_due, 0)
      THEN ' | ok return date resumes billing'
    ELSE ' | FAIL return date status or charge after=' || COALESCE(v_after::text, 'null')
      || ' due=' || COALESCE(v_due::text, 'null')
  END;

  PERFORM public.staff_add_group_member(v_eng, v_hand_user, 'active', v_hand, v_hand, false, NULL);
  PERFORM public._billing_charge_class_month(v_hand_user, v_class, v_this, 'auto');
  PERFORM public.staff_freeze_group_member(v_eng, v_hand_user, v_this, NULL);
  PERFORM public.staff_activate_group_member(v_eng, v_hand_user, NULL);
  SELECT b.amount_uzs INTO v_due FROM public._bs_class_month_billable(v_hand_user, v_class, v_this) b;
  SELECT e.amount_uzs INTO v_after
  FROM public.ledger_entries e
  WHERE e.user_id = v_hand_user AND e.period = v_this AND e.kind = 'charge' AND e.voided_at IS NULL;
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'active' AND m.frozen_on IS NULL
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_hand_user
    ) AND v_after IS NOT DISTINCT FROM NULLIF(v_due, 0)
      THEN ' | ok activate now resumes billing'
    ELSE ' | FAIL activate now after=' || COALESCE(v_after::text, 'null')
      || ' due=' || COALESCE(v_due::text, 'null')
  END;

  PERFORM public.staff_add_group_member(v_eng, v_trial, 'trial', v_hand, v_hand, false, NULL);
  PERFORM public.staff_freeze_group_member(v_eng, v_trial, v_today, NULL);
  PERFORM public.staff_activate_group_member(v_eng, v_trial, NULL);
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'trial' FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_trial
    ) THEN ' | ok trial restored' ELSE ' | FAIL trial not restored' END;

  PERFORM public.staff_add_group_member(v_eng, v_later, 'active', v_hand, v_hand, false, NULL);
  PERFORM public.staff_freeze_group_member(v_eng, v_later, v_today + 14, NULL);
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'active' AND m.frozen_on = v_today + 14
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_later
    ) THEN ' | ok future start waits' ELSE ' | FAIL future start applied early' END;
  PERFORM public._billing_apply_due_freezes(v_today);
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'active' FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_later
    ) THEN ' | ok job waits for the start' ELSE ' | FAIL job froze early' END;
  PERFORM public._billing_apply_due_freezes(v_today + 14);
  v_out := v_out || CASE WHEN (
      SELECT m.status = 'frozen' AND m.frozen_on = v_today + 14
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_later
    ) THEN ' | ok future start freezes on its day' ELSE ' | FAIL future start did not freeze' END;

  BEGIN
    PERFORM public.staff_freeze_group_member(v_eng, v_later, v_today, v_today);
    v_out := v_out || ' | FAIL same-day return allowed';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%after the freeze start%' THEN
      v_out := v_out || ' | ok return must be later';
    ELSE
      RAISE;
    END IF;
  END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
