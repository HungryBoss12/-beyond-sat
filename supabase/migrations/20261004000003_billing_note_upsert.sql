-- A profile without a students row can still keep a billing note.

CREATE OR REPLACE FUNCTION public.admin_set_billing_note(p_user_id uuid, p_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  INSERT INTO public.students (user_id, full_name, billing_note)
  SELECT
    p.id,
    COALESCE(NULLIF(btrim(p.full_name), ''), 'Student'),
    NULLIF(btrim(p_note), '')
  FROM public.profiles p
  WHERE p.id = p_user_id
  ON CONFLICT (user_id) DO UPDATE
    SET billing_note = EXCLUDED.billing_note;
END;
$$;
