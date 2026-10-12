-- Assign a support window by username or user id.

CREATE OR REPLACE FUNCTION public.staff_assign_support_by_name(p_window_id uuid, p_name text)
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
  IF v_name = '' THEN
    RAISE EXCEPTION 'Enter the student username';
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
  PERFORM public.staff_assign_support_window(p_window_id, v_student);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_assign_support_by_name(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_assign_support_by_name(uuid, text) TO authenticated, service_role;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261012000005', 'support_assign_by_name')
ON CONFLICT (version) DO NOTHING;
