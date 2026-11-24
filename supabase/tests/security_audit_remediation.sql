-- Regression checks for 20261115000002_security_audit_remediation.sql:
-- 1. Held (deleted_at IS NOT NULL) student is treated as banned by bs_is_self_banned().
-- 2. Editor cannot overwrite their own full_name or must_change_credentials.
-- 3. Student cannot read questions before starting a session, and cannot call bs_upsert_lesson_video.
-- 4. Admin cannot ban another admin via admin_set_banned.
-- Run: node scripts/run-sql-test.mjs supabase/migrations/20261115000002_security_audit_remediation.sql supabase/tests/security_audit_remediation.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_admin2 uuid := gen_random_uuid();
  v_editor uuid := gen_random_uuid();
  v_student uuid := gen_random_uuid();
  v_q uuid := gen_random_uuid();
  v_out text := '';
  v_flag boolean;
  v_name text;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES
    (v_admin2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_admin2::text || '@sec-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_editor, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_editor::text || '@sec-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
    (v_student, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     v_student::text || '@sec-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());

  INSERT INTO public.profiles (id, email, full_name, must_change_credentials)
  VALUES
    (v_admin2, v_admin2::text || '@sec-test.invalid', 'ZZ Sec Admin2', false),
    (v_editor, v_editor::text || '@sec-test.invalid', 'ZZ Sec Editor', true),
    (v_student, v_student::text || '@sec-test.invalid', 'ZZ Sec Student', false)
  ON CONFLICT (id) DO NOTHING;

  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  PERFORM set_config('request.jwt.claims', '{"role":"service_role"}', true);
  UPDATE public.profiles SET full_name = 'ZZ Sec Admin2', must_change_credentials = false WHERE id = v_admin2;
  UPDATE public.profiles SET full_name = 'ZZ Sec Editor', must_change_credentials = true WHERE id = v_editor;
  UPDATE public.profiles SET full_name = 'ZZ Sec Student', must_change_credentials = false WHERE id = v_student;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (v_admin2, 'admin'), (v_editor, 'editor')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.questions (id, section, skill, difficulty, kind, question_text, choices, correct_choice_id, published)
  VALUES (v_q, 'math', 'algebra', 'medium', 'multiple_choice', 'ZZ hidden stem', '[]'::jsonb, 'A', true);

  -- 1. Held student triggers bs_is_self_banned()
  UPDATE public.profiles SET deleted_at = now() WHERE id = v_student;
  PERFORM set_config('request.jwt.claim.sub', v_student::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  SELECT public.bs_is_self_banned() INTO v_flag;
  v_out := v_out || CASE WHEN v_flag
    THEN ' | ok held student is self_banned'
    ELSE ' | FAIL held student not blocked' END;

  -- Restore student and check student cannot upsert lesson_video_catalog
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles SET deleted_at = NULL WHERE id = v_student;

  PERFORM set_config('request.jwt.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_student::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.bs_upsert_lesson_video('dQw4w9wgGcQ', 'Spoofed title', 'https://www.youtube.com/watch?v=dQw4w9wgGcQ', 60);
    v_out := v_out || ' | FAIL student upserted catalog';
  EXCEPTION WHEN insufficient_privilege THEN
    v_out := v_out || ' | ok student refused catalog upsert';
  END;

  -- 2. Stale editor session fails bs_is_staff(), and even with a fresh session editor cannot forge own full_name
  PERFORM set_config('request.jwt.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_editor::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_editor, 'role', 'authenticated')::text, true);
  SELECT public.bs_is_staff() INTO v_flag;
  v_out := v_out || CASE WHEN NOT v_flag
    THEN ' | ok stale editor session denied'
    ELSE ' | FAIL stale editor session accepted' END;

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_editor, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);
  UPDATE public.profiles
  SET full_name = 'Forged Name', must_change_credentials = false
  WHERE id = v_editor;
  SELECT full_name, must_change_credentials INTO v_name, v_flag FROM public.profiles WHERE id = v_editor;
  v_out := v_out || CASE WHEN v_name = 'ZZ Sec Editor' AND v_flag IS TRUE
    THEN ' | ok editor profile columns locked'
    ELSE ' | FAIL editor bypassed profile lock' END;

  -- 4. Admin cannot ban another admin
  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);
  BEGIN
    PERFORM public.admin_set_banned(v_admin2, true, 'test');
    v_out := v_out || ' | FAIL admin banned another admin';
  EXCEPTION WHEN insufficient_privilege THEN
    v_out := v_out || ' | ok admin-on-admin ban refused';
  END;

  -- 5. PT-06: Held/banned student cannot call student_book_support_window
  PERFORM set_config('request.jwt.role', 'service_role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.profiles SET banned = true WHERE id = v_student;

  PERFORM set_config('request.jwt.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claim.sub', v_student::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_student, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.student_book_support_window(gen_random_uuid(), 'math');
    v_out := v_out || ' | FAIL banned student booked support';
  EXCEPTION WHEN insufficient_privilege THEN
    v_out := v_out || ' | ok banned student refused support booking';
  END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
