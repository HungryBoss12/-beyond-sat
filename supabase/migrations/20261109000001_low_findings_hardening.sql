-- Low-severity fixes from the November 2026 security review.
--
-- 1. Telegram admin link codes: 10 hex characters (40 bits) instead of 6.
--    A linked chat can ban and unban users; the webhook also caps /link
--    attempts per chat.
-- 2. staff_assign_support_by_name checked the username before any permission
--    check, so any signed-in user could learn whether a username exists.
-- 3. public_submit_lid keyed its limit on the first x-forwarded-for entry,
--    which the caller controls. It now uses cf-connecting-ip, then the entry
--    the nearest proxy appended, plus a global hourly cap.
--
-- CREATE OR REPLACE keeps each function's existing grants.

CREATE OR REPLACE FUNCTION public.admin_create_telegram_link_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can create Telegram link codes';
  END IF;

  v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.admin_telegram_link_codes (code, admin_user_id, expires_at)
  VALUES (v_code, auth.uid(), now() + interval '10 minutes');

  RETURN v_code;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_assign_support_by_name(
  p_window_id uuid,
  p_name text,
  p_subject public.class_subject
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := btrim(COALESCE(p_name, ''));
  v_student uuid;
  v_count integer;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff only' USING ERRCODE = '42501';
  END IF;
  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter the student username';
  END IF;
  IF p_subject IS NULL OR p_subject::text NOT IN ('ebrw', 'math') THEN
    RAISE EXCEPTION 'Pick English or Math';
  END IF;
  SELECT count(*) INTO v_count
  FROM public.profiles p
  WHERE p.username = v_name OR p.id::text = v_name;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Student not found';
  END IF;
  IF v_count > 1 THEN
    RAISE EXCEPTION 'That name matches more than one account';
  END IF;
  SELECT p.id INTO v_student
  FROM public.profiles p
  WHERE p.username = v_name OR p.id::text = v_name;
  PERFORM public.staff_assign_support_window(p_window_id, v_student, p_subject);
END;
$$;

CREATE OR REPLACE FUNCTION public.public_submit_lid(
  p_name text,
  p_phone text,
  p_class text,
  p_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_headers jsonb := COALESCE(current_setting('request.headers', true)::jsonb, '{}'::jsonb);
  v_ip text := COALESCE(
    NULLIF(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    NULLIF(btrim(regexp_replace(COALESCE(v_headers ->> 'x-forwarded-for', ''), '^.*,', '')), ''),
    'anon'
  );
  v_rate jsonb;
BEGIN
  IF btrim(COALESCE(p_name, '')) = '' OR btrim(COALESCE(p_phone, '')) = '' OR btrim(COALESCE(p_class, '')) = '' THEN
    RAISE EXCEPTION 'Name, phone, and class are required';
  END IF;
  IF char_length(p_name) > 120
     OR char_length(p_phone) > 40
     OR char_length(p_class) > 80
     OR char_length(COALESCE(p_note, '')) > 500 THEN
    RAISE EXCEPTION 'That entry is too long';
  END IF;

  v_rate := public.bs_take_rate_token('lid:' || v_ip, 5, 1);
  IF COALESCE((v_rate ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Too many submissions. Please wait a minute and try again.';
  END IF;

  v_rate := public.bs_take_rate_token('lid-all', 200, 200.0 / 60);
  IF COALESCE((v_rate ->> 'ok')::boolean, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Too many submissions. Please wait a minute and try again.';
  END IF;

  INSERT INTO public.lids (full_name, phone, wanted_class, note)
  VALUES (
    btrim(p_name),
    btrim(p_phone),
    btrim(p_class),
    NULLIF(btrim(COALESCE(p_note, '')), '')
  );
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261109000001', 'low_findings_hardening')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
