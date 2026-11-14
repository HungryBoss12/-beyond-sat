-- A student can only store a path inside their own folder, cannot write storage
-- outside it, and staff can clear a photo.
-- Run: node scripts/run-sql-test.mjs supabase/migrations/20261115000001_profile_pictures.sql supabase/tests/profile_pictures.sql
DO $$
DECLARE
  v_admin uuid := (SELECT r.user_id FROM public.user_roles r WHERE r.role = 'admin' ORDER BY r.user_id LIMIT 1);
  v_s uuid := gen_random_uuid();
  v_o uuid := gen_random_uuid();
  v_out text := '';
  v_val text;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (v_s, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_s::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now()),
         (v_o, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          v_o::text || '@billing-test.invalid', '{"staff_created":"true"}'::jsonb, '{}'::jsonb, now(), now());
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (v_s, v_s::text || '@billing-test.invalid', 'ZZ avatar'),
         (v_o, v_o::text || '@billing-test.invalid', 'ZZ avatar other')
  ON CONFLICT (id) DO NOTHING;

  BEGIN
    UPDATE public.profiles SET avatar_url = 'https://evil.example/x.png' WHERE id = v_s;
    v_out := v_out || ' | FAIL external url accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_out := v_out || ' | ok external url refused';
  END;

  BEGIN
    UPDATE public.profiles SET avatar_url = v_o::text || '/avatar-abcdef12.webp' WHERE id = v_s;
    v_out := v_out || ' | FAIL foreign folder accepted';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    v_out := v_out || ' | ok foreign folder refused';
  END;

  UPDATE public.profiles SET avatar_url = v_s::text || '/avatar-abcdef12.webp' WHERE id = v_s;
  SELECT avatar_url INTO v_val FROM public.profiles WHERE id = v_s;
  v_out := v_out || CASE WHEN v_val = v_s::text || '/avatar-abcdef12.webp'
    THEN ' | ok own path saved' ELSE ' | FAIL own path not saved' END;

  UPDATE public.profiles SET bio = 'hello' WHERE id = v_s;
  BEGIN
    UPDATE public.profiles SET bio = repeat('x', 71) WHERE id = v_s;
    v_out := v_out || ' | FAIL long bio accepted';
  EXCEPTION WHEN check_violation THEN
    v_out := v_out || ' | ok long bio refused';
  END;

  -- A student cannot clear someone else's photo through the staff RPC.
  PERFORM set_config('request.jwt.claim.sub', v_s::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_s, 'role', 'authenticated')::text, true);
  BEGIN
    PERFORM public.staff_remove_avatar(v_s);
    v_out := v_out || ' | FAIL student cleared via staff rpc';
  EXCEPTION WHEN insufficient_privilege THEN
    v_out := v_out || ' | ok student refused staff rpc';
  END;

  PERFORM set_config('request.jwt.claim.sub', v_admin::text, true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', v_admin, 'role', 'authenticated',
      'amr', json_build_array(json_build_object('method', 'password',
        'timestamp', extract(epoch FROM now())::bigint)))::text, true);
  PERFORM public.staff_remove_avatar(v_s);
  SELECT avatar_url INTO v_val FROM public.profiles WHERE id = v_s;
  v_out := v_out || CASE WHEN v_val IS NULL
    THEN ' | ok staff cleared photo' ELSE ' | FAIL photo still set' END;

  RAISE EXCEPTION 'RESULT%', v_out;
END $$;
