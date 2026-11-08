-- A past freeze through 29 October 2026 drops that day from the fee, keeps the
-- student active, voids the old charge with the reason, and replaces it only
-- for a lesson after the 29th (30 October is a Friday on this schedule).
-- Rolls back by raising 'RESULT ...'.
-- Run: npx supabase db query --linked -f supabase/tests/past_freeze.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_class uuid;
  v_eng uuid;
  v_s uuid := gen_random_uuid();
  v_full bigint;
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

  INSERT INTO public.classes (name) VALUES ('ZZ past freeze') RETURNING id INTO v_class;
  INSERT INTO public.class_fees (class_id, monthly_fee_uzs, effective_from)
  VALUES (v_class, 1200000, date '2026-01-01');
  UPDATE public.class_groups
  SET name = 'ZZ past Eng', schedule_days = ARRAY[1, 3, 5]::smallint[]
  WHERE class_id = v_class AND subject = 'ebrw'
  RETURNING id INTO v_eng;

  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  PERFORM public.staff_add_group_member(v_eng, v_s, 'active', date '2026-10-01', date '2026-10-01', false, NULL);
  INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, kind)
  VALUES (v_s, v_class, v_eng, 'active', date '2026-10-15', 'status');
  -- Events written in this transaction share one timestamp. The enrolment has to
  -- be older than the freeze, as it would be when the student joined earlier.
  UPDATE public.class_membership_events
  SET created_at = now() - interval '2 days'
  WHERE user_id = v_s AND group_id = v_eng;
  PERFORM public._billing_charge_class_month(v_s, v_class, date '2026-10-01', 'auto');

  SELECT e.amount_uzs INTO v_full
  FROM public.ledger_entries e
  WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL;

  BEGIN
    PERFORM public.staff_freeze_group_member(v_eng, v_s, date '2026-10-01', date '2026-10-30', NULL);
    v_out := v_out || ' | FAIL finished window without a reason';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM ILIKE '%reason%' THEN
      v_out := v_out || ' | ok finished window needs a reason';
    ELSE
      RAISE;
    END IF;
  END;

  PERFORM public.staff_freeze_group_member(
    v_eng, v_s, date '2026-10-01', date '2026-10-30', 'did not come'
  );

  v_out := v_out || CASE WHEN (
      SELECT m.status = 'active' AND m.frozen_on IS NULL
      FROM public.class_group_memberships m
      WHERE m.group_id = v_eng AND m.user_id = v_s
    ) THEN ' | ok still active' ELSE ' | FAIL status after past freeze' END;

  v_out := v_out || CASE
    WHEN public._bs_group_status_on(v_s, v_eng, date '2026-10-29') = 'frozen'
     AND public._bs_group_status_on(v_s, v_eng, date '2026-10-30') = 'active'
    THEN ' | ok 29 Oct frozen and 30 Oct active'
    ELSE ' | FAIL day status 29=' || COALESCE(public._bs_group_status_on(v_s, v_eng, date '2026-10-29'), 'null')
      || ' 30=' || COALESCE(public._bs_group_status_on(v_s, v_eng, date '2026-10-30'), 'null')
  END;

  v_out := v_out || CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.class_membership_events ev
      WHERE ev.user_id = v_s AND ev.group_id = v_eng AND ev.effective_on = date '2026-10-15'
    ) THEN ' | ok in-window status event removed'
    ELSE ' | FAIL 15 Oct event kept' END;

  v_out := v_out || CASE WHEN EXISTS (
      SELECT 1 FROM public.ledger_entries e
      WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.kind = 'charge'
        AND e.voided_at IS NOT NULL AND e.void_reason = 'frozen: did not come'
        AND e.amount_uzs = v_full
    ) THEN ' | ok old charge voided with the reason'
    ELSE ' | FAIL void reason or amount' END;

  SELECT b.amount_uzs INTO v_due FROM public._bs_class_month_billable(v_s, v_class, date '2026-10-01') b;
  SELECT e.amount_uzs INTO v_after
  FROM public.ledger_entries e
  WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL;

  v_out := v_out || CASE
    WHEN v_after IS NOT DISTINCT FROM NULLIF(v_due, 0)
     AND COALESCE(v_after, 0) < COALESCE(v_full, 0)
     AND EXISTS (
       SELECT 1 FROM public.ledger_entries e
       WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.voided_at IS NULL
         AND e.note LIKE '%frozen 1 Oct-29 Oct 2026: did not come%'
     )
    THEN ' | ok replacement is the days after 29 Oct'
    ELSE ' | FAIL replacement after=' || COALESCE(v_after::text, 'null')
      || ' due=' || COALESCE(v_due::text, 'null')
      || ' full=' || COALESCE(v_full::text, 'null')
      || ' note=' || COALESCE((
           SELECT e.note FROM public.ledger_entries e
           WHERE e.user_id = v_s AND e.period = date '2026-10-01' AND e.voided_at IS NULL
         ), 'null')
  END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
