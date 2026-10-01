-- Classes v2 acceptance checks (§10 items 1-6) against the live schema.
-- Every write happens inside one sub-block that ends by raising, so it is all
-- rolled back. Results survive in PL/pgSQL variables and are copied to a temp table.
-- Run with: node scripts/acceptance/v2-db.mjs

CREATE TEMP TABLE IF NOT EXISTS _acc (n serial, check_name text, ok boolean, detail text);
TRUNCATE _acc;

DO $$
DECLARE
  v_out jsonb := '[]'::jsonb;
  v_admin uuid;
  v_a uuid;
  v_b uuid;
  v_class uuid;
  v_class2 uuid;
  v_math uuid;
  v_eng uuid;
  v_math2 uuid;
  v_lesson uuid;
  v_elesson uuid;
  v_n int;
  v_n2 int;
  v_amt bigint;
  v_txt text;
  d date;

  -- Appends one result row.
  -- (PL/pgSQL has no closures; each check builds its own jsonb.)
BEGIN
  BEGIN
    SELECT r.user_id INTO v_admin FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1;
    SELECT p.id INTO v_a FROM public.profiles p
    WHERE NOT EXISTS (SELECT 1 FROM public.class_memberships m WHERE m.user_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('admin', 'editor'))
    ORDER BY p.id LIMIT 1;
    SELECT p.id INTO v_b FROM public.profiles p
    WHERE p.id <> v_a
      AND NOT EXISTS (SELECT 1 FROM public.class_memberships m WHERE m.user_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('admin', 'editor'))
    ORDER BY p.id LIMIT 1;
    IF v_admin IS NULL OR v_a IS NULL OR v_b IS NULL THEN
      RAISE EXCEPTION 'setup: need one admin and two students without a class';
    END IF;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin, 'role', 'authenticated')::text, true);

    -- 1. Structure ------------------------------------------------------------
    INSERT INTO public.classes (name, active, created_by) VALUES ('ZZ Acceptance', true, v_admin) RETURNING id INTO v_class;
    SELECT count(*) INTO v_n FROM public.class_groups WHERE class_id = v_class;
    v_out := v_out || jsonb_build_object('check', '1 parent insert creates 2 sub-classes', 'ok', v_n = 2, 'detail', v_n);
    SELECT id INTO v_math FROM public.class_groups WHERE class_id = v_class AND subject = 'math';
    SELECT id INTO v_eng FROM public.class_groups WHERE class_id = v_class AND subject = 'ebrw';

    BEGIN
      INSERT INTO public.class_groups (class_id, subject, name) VALUES (v_class, 'math', 'dup');
      v_out := v_out || jsonb_build_object('check', '1 duplicate subject sub-class fails', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '1 duplicate subject sub-class fails', 'ok', true, 'detail', SQLERRM);
    END;

    BEGIN
      DELETE FROM public.class_groups WHERE id = v_eng;
      v_out := v_out || jsonb_build_object('check', '1 single sub-class delete fails', 'ok', false, 'detail', 'deleted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '1 single sub-class delete fails', 'ok', true, 'detail', SQLERRM);
    END;

    PERFORM public.staff_add_group_member(v_math, v_a, 'active', '2026-03-01', '2026-03-15', false);
    PERFORM public.staff_add_group_member(v_math, v_b, 'active', '2026-03-01', '2026-03-01', false);
    PERFORM public.staff_add_group_member(v_eng, v_b, 'active', '2026-03-01', '2026-03-01', false);
    SELECT count(*) INTO v_n FROM public.class_memberships WHERE class_id = v_class;
    v_out := v_out || jsonb_build_object('check', '1 parent membership is derived', 'ok', v_n = 2, 'detail', v_n);

    INSERT INTO public.classes (name, active, created_by) VALUES ('ZZ Acceptance 2', true, v_admin) RETURNING id INTO v_class2;
    SELECT id INTO v_math2 FROM public.class_groups WHERE class_id = v_class2 AND subject = 'math';
    BEGIN
      INSERT INTO public.class_group_memberships (group_id, user_id, class_id, subject, status, enrolled_on)
      VALUES (v_math2, v_a, v_class2, 'math', 'active', '2026-03-01');
      v_out := v_out || jsonb_build_object('check', '1 second live Maths membership fails', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '1 second live Maths membership fails', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      PERFORM public.staff_add_group_member(v_math2, v_a, 'active', NULL, NULL, false);
      v_out := v_out || jsonb_build_object('check', '1 moving parents needs p_move', 'ok', false, 'detail', 'added');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '1 moving parents needs p_move', 'ok', SQLERRM LIKE '%already_in_other_class%', 'detail', SQLERRM);
    END;

    -- 2. Schemes and tick/untick -------------------------------------------------
    FOREACH d IN ARRAY ARRAY[
      '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09', '2026-03-10', '2026-03-11',
      '2026-03-16', '2026-03-17', '2026-03-18', '2026-03-19', '2026-03-20'
    ]::date[] LOOP
      INSERT INTO public.class_lessons (group_id, lesson_date) VALUES (v_math, d);
    END LOOP;
    SELECT id INTO v_lesson FROM public.class_lessons WHERE group_id = v_math ORDER BY lesson_date LIMIT 1;
    INSERT INTO public.class_lessons (group_id, lesson_date) VALUES (v_eng, '2026-03-03') RETURNING id INTO v_elesson;

    BEGIN
      INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id) VALUES (v_lesson, v_a, 'vocab', v_math);
      v_out := v_out || jsonb_build_object('check', '2 AFL rejects vocab', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '2 AFL rejects vocab', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id) VALUES (v_lesson, v_a, 'article', v_math);
      v_out := v_out || jsonb_build_object('check', '2 AFL rejects article', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '2 AFL rejects article', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      INSERT INTO public.lesson_hw_marks (lesson_id, user_id, item, group_id) VALUES (v_elesson, v_b, 'formulas', v_eng);
      v_out := v_out || jsonb_build_object('check', '2 VAR rejects formulas', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '2 VAR rejects formulas', 'ok', true, 'detail', SQLERRM);
    END;

    PERFORM public.tick_all_complete(v_lesson, ARRAY[v_a]);
    SELECT count(*) FILTER (WHERE user_id = v_a AND done), count(*) FILTER (WHERE user_id = v_b)
    INTO v_n, v_n2 FROM public.lesson_hw_marks WHERE lesson_id = v_lesson;
    v_out := v_out || jsonb_build_object('check', '2 tick all touches only the listed students', 'ok', v_n = 2 AND v_n2 = 0,
                                         'detail', format('a=%s b=%s', v_n, v_n2));
    PERFORM public.untick_all(v_lesson, ARRAY[v_a]);
    SELECT count(*) FILTER (WHERE done) INTO v_n FROM public.lesson_hw_marks WHERE lesson_id = v_lesson AND user_id = v_a;
    SELECT count(*) INTO v_n2 FROM public.lesson_attendance
    WHERE group_id = v_math AND user_id = v_a AND lesson_date = '2026-03-02' AND participated;
    v_out := v_out || jsonb_build_object('check', '2 untick all clears items and keeps attendance', 'ok', v_n = 0 AND v_n2 = 1,
                                         'detail', format('done=%s present=%s', v_n, v_n2));

    -- 3. Level --------------------------------------------------------------------
    BEGIN
      PERFORM public.staff_save_level_scores(v_math, v_a, '2026-03-20', '{"systems": 399}'::jsonb, NULL);
      v_out := v_out || jsonb_build_object('check', '3 level 399 rejected', 'ok', false, 'detail', 'saved');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '3 level 399 rejected', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      PERFORM public.staff_save_level_scores(v_math, v_a, '2026-03-20', '{"systems": 1001}'::jsonb, NULL);
      v_out := v_out || jsonb_build_object('check', '3 level 1001 rejected', 'ok', false, 'detail', 'saved');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '3 level 1001 rejected', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      INSERT INTO public.student_level_scores (user_id, group_id, section_id, score, assessed_on)
      SELECT v_a, v_math, id, 1001, '2026-03-20' FROM public.level_sections WHERE subject = 'math' AND slug = 'systems';
      v_out := v_out || jsonb_build_object('check', '3 level CHECK blocks 1001', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '3 level CHECK blocks 1001', 'ok', true, 'detail', SQLERRM);
    END;
    v_n := public.staff_save_level_scores(v_math, v_a, '2026-03-20', '{"systems": 400, "circle": 1000}'::jsonb, v_lesson);
    SELECT overall INTO v_n2 FROM public.staff_level_board(v_math) WHERE user_id = v_a;
    v_out := v_out || jsonb_build_object('check', '3 overall is the mean of entered sections', 'ok', v_n = 2 AND v_n2 = 700,
                                         'detail', format('saved=%s overall=%s', v_n, v_n2));
    PERFORM public.staff_void_level_score(s.id, 'typo')
    FROM public.student_level_scores s JOIN public.level_sections ls ON ls.id = s.section_id
    WHERE s.user_id = v_a AND s.group_id = v_math AND ls.slug = 'circle';
    SELECT overall INTO v_n2 FROM public.staff_level_board(v_math) WHERE user_id = v_a;
    v_out := v_out || jsonb_build_object('check', '3 void recalculates the overall', 'ok', v_n2 = 400, 'detail', v_n2);

    -- 4. Results ------------------------------------------------------------------
    BEGIN
      PERFORM public.staff_set_result(v_lesson, v_a, 28, 1);
      v_out := v_out || jsonb_build_object('check', '4 M1 = 28 rejected', 'ok', false, 'detail', 'saved');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '4 M1 = 28 rejected', 'ok', true, 'detail', SQLERRM);
    END;
    PERFORM public.staff_set_result(v_lesson, v_a, 15, 15);
    SELECT m1 + m2 INTO v_n FROM public.lesson_results WHERE lesson_id = v_lesson AND user_id = v_a;
    v_out := v_out || jsonb_build_object('check', '4 15 + 15 = 30', 'ok', v_n = 30, 'detail', v_n);

    -- 5. Billing ------------------------------------------------------------------
    PERFORM public.admin_set_group_fee(v_math, 1300000, '2026-03-01');
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on)
    VALUES (v_b, v_class, v_math, 'frozen', '2026-03-31'), (v_b, v_class, v_math, 'active', '2026-05-01');

    v_n := public.admin_apply_recurring_fees('2026-05-15');
    v_n2 := public.admin_apply_recurring_fees('2026-05-15');
    v_out := v_out || jsonb_build_object('check', '5 charge monthly fee twice adds N then 0', 'ok', v_n = 5 AND v_n2 = 0,
                                         'detail', format('first=%s second=%s', v_n, v_n2));

    SELECT amount_uzs, note INTO v_amt, v_txt FROM public.ledger_entries
    WHERE user_id = v_a AND group_id = v_math AND period = '2026-03-01' AND voided_at IS NULL;
    v_out := v_out || jsonb_build_object('check', '5 join month 5/13 of 1 300 000 = 500 000', 'ok', v_amt = 500000,
                                         'detail', format('%s · %s', v_amt, v_txt));
    SELECT amount_uzs INTO v_amt FROM public.ledger_entries
    WHERE user_id = v_a AND group_id = v_math AND period = '2026-04-01' AND voided_at IS NULL;
    v_out := v_out || jsonb_build_object('check', '5 later months are full price', 'ok', v_amt = 1300000, 'detail', v_amt);
    SELECT count(*) INTO v_n FROM public.ledger_entries
    WHERE user_id = v_b AND group_id = v_math AND period = '2026-04-01' AND voided_at IS NULL;
    v_out := v_out || jsonb_build_object('check', '5 frozen all of April is not charged', 'ok', v_n = 0, 'detail', v_n);
    SELECT count(*) INTO v_n FROM public.ledger_entries WHERE group_id = v_eng;
    v_out := v_out || jsonb_build_object('check', '5 unpriced sub-class makes 0 charges', 'ok', v_n = 0, 'detail', v_n);

    PERFORM public.admin_charge_month(v_a, '2026-06-01');
    v_n := public.admin_set_activation_date(v_a, v_math, '2026-04-10');
    SELECT count(*) INTO v_n2 FROM public.ledger_entries
    WHERE user_id = v_a AND group_id = v_math AND period = '2026-06-01' AND source = 'manual' AND voided_at IS NULL;
    SELECT count(*) INTO v_amt FROM public.ledger_entries
    WHERE user_id = v_a AND group_id = v_math AND period = '2026-03-01' AND voided_at IS NULL;
    v_out := v_out || jsonb_build_object('check', '5 moving activation voids only auto rows', 'ok', v_n = 2 AND v_n2 = 1 AND v_amt = 0,
                                         'detail', format('voided=%s manual_june_live=%s march_live=%s', v_n, v_n2, v_amt));

    -- 6. Payment safety -------------------------------------------------------------
    BEGIN
      PERFORM public.admin_record_payment(v_a, 232323232323, 'cash', '2026-03-20', 'x', gen_random_uuid());
      v_out := v_out || jsonb_build_object('check', '6 RPC rejects 232323232323', 'ok', false, 'detail', 'recorded');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '6 RPC rejects 232323232323', 'ok', true, 'detail', SQLERRM);
    END;
    BEGIN
      INSERT INTO public.ledger_entries (user_id, kind, amount_uzs, method, occurred_on, note)
      VALUES (v_a, 'payment', 232323232323, 'cash', '2026-03-20', 'x');
      v_out := v_out || jsonb_build_object('check', '6 CHECK rejects 232323232323', 'ok', false, 'detail', 'inserted');
    EXCEPTION WHEN OTHERS THEN
      v_out := v_out || jsonb_build_object('check', '6 CHECK rejects 232323232323', 'ok', true, 'detail', SQLERRM);
    END;
    PERFORM public.admin_record_payment(v_a, 15000000, 'cash', '2026-03-20', 'large', gen_random_uuid());
    v_out := v_out || jsonb_build_object('check', '6 15 000 000 is accepted by the server (UI confirms)', 'ok', true, 'detail', 'recorded');

    RAISE EXCEPTION 'acceptance_rollback';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'acceptance_rollback' THEN
      v_out := v_out || jsonb_build_object('check', 'script error', 'ok', false, 'detail', SQLERRM);
    END IF;
  END;

  INSERT INTO _acc (check_name, ok, detail)
  SELECT x->>'check', (x->>'ok')::boolean, x->>'detail' FROM jsonb_array_elements(v_out) x;
END $$;

SELECT check_name, ok, detail FROM _acc ORDER BY n;
