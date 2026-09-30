-- Membership status changes go through a staff RPC. Editors cannot rewrite enrolled_on.

REVOKE UPDATE ON public.class_memberships FROM authenticated;
DROP POLICY IF EXISTS "memberships update staff" ON public.class_memberships;

CREATE OR REPLACE FUNCTION public.staff_set_member_status(
  p_user_id uuid,
  p_status public.class_member_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  UPDATE public.class_memberships
  SET status = p_status
  WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in a class';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_member_status(uuid, public.class_member_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_member_status(uuid, public.class_member_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_class_member(
  p_class_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT 'active',
  p_enrolled_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_enrolled date;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class_id) THEN
    RAISE EXCEPTION 'That class group was not found.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT m.class_id, m.enrolled_on INTO v_class, v_enrolled
  FROM public.class_memberships m
  WHERE m.user_id = p_user_id;

  IF v_class = p_class_id THEN
    IF p_enrolled_on IS NOT NULL
       AND p_enrolled_on IS DISTINCT FROM v_enrolled
       AND NOT public.bs_is_admin() THEN
      RAISE EXCEPTION 'Admin access required';
    END IF;
    UPDATE public.class_memberships
    SET status = p_status,
        enrolled_on = CASE
          WHEN public.bs_is_admin() THEN COALESCE(p_enrolled_on, enrolled_on)
          ELSE enrolled_on
        END
    WHERE user_id = p_user_id;
    RETURN;
  END IF;

  IF v_class IS NOT NULL THEN
    DELETE FROM public.class_memberships WHERE user_id = p_user_id;
  END IF;

  INSERT INTO public.class_memberships (class_id, user_id, status, enrolled_on)
  VALUES (
    p_class_id,
    p_user_id,
    p_status,
    COALESCE(p_enrolled_on, public.bs_tashkent_today())
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_class_member(uuid, uuid, public.class_member_status, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_class_member(uuid, uuid, public.class_member_status, date) TO authenticated;
