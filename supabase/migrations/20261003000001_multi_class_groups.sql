-- A student may belong to more than one class, and to more than one
-- Maths or Eng group. Move still leaves the class they are moving from.

DROP INDEX IF EXISTS public.class_group_memberships_one_live_per_subject;

CREATE OR REPLACE FUNCTION public.bs_sync_parent_membership(p_class_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int;
  v_status public.class_member_status;
  v_enrolled date;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.classes WHERE id = p_class_id) THEN
    RETURN;
  END IF;
  SELECT
    count(*),
    CASE
      WHEN bool_or(status = 'active') THEN 'active'
      WHEN bool_or(status = 'trial') THEN 'trial'
      ELSE 'frozen'
    END::public.class_member_status,
    min(enrolled_on)
  INTO v_count, v_status, v_enrolled
  FROM public.class_group_memberships
  WHERE class_id = p_class_id AND user_id = p_user_id AND status <> 'left';

  IF v_count = 0 THEN
    DELETE FROM public.class_memberships WHERE class_id = p_class_id AND user_id = p_user_id;
    RETURN;
  END IF;

  INSERT INTO public.class_memberships (class_id, user_id, status, enrolled_on)
  VALUES (p_class_id, p_user_id, v_status, v_enrolled)
  ON CONFLICT (class_id, user_id) DO UPDATE
    SET status = EXCLUDED.status
    WHERE class_memberships.status IS DISTINCT FROM EXCLUDED.status;
END;
$$;

CREATE OR REPLACE FUNCTION public.class_memberships_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other uuid;
BEGIN
  UPDATE public.profiles
     SET class_id = NULL
   WHERE id = OLD.user_id AND class_id = OLD.class_id;

  SELECT m.class_id INTO v_other
  FROM public.class_memberships m
  WHERE m.user_id = OLD.user_id
  ORDER BY m.enrolled_on NULLS LAST
  LIMIT 1;
  IF v_other IS NOT NULL THEN
    UPDATE public.profiles
       SET class_id = v_other
     WHERE id = OLD.user_id AND class_id IS NULL;
  END IF;

  DELETE FROM public.class_group_memberships
  WHERE class_id = OLD.class_id AND user_id = OLD.user_id;

  DELETE FROM public.chat_thread_members m
  USING public.chat_threads t
  WHERE m.thread_id = t.id
    AND m.user_id = OLD.user_id
    AND t.class_id = OLD.class_id
    AND t.kind IN ('subject_group', 'class_group');

  RETURN OLD;
END;
$$;

DROP FUNCTION IF EXISTS public.staff_add_group_member(uuid, uuid, public.class_member_status, date, date, boolean);

CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT 'active',
  p_enrolled_on date DEFAULT NULL,
  p_activated_on date DEFAULT NULL,
  p_move boolean DEFAULT false,
  p_from_class_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_existing public.class_group_memberships%ROWTYPE;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_move AND NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF p_activated_on IS NOT NULL AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;

  IF p_move THEN
    DELETE FROM public.class_memberships
    WHERE user_id = p_user_id
      AND class_id <> v_class
      AND (p_from_class_id IS NULL OR class_id = p_from_class_id);
  END IF;

  SELECT * INTO v_existing FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF FOUND AND p_enrolled_on IS NOT NULL AND p_enrolled_on IS DISTINCT FROM v_existing.enrolled_on
     AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, p_enrolled_on, p_activated_on);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_add_group_member(uuid, uuid, public.class_member_status, date, date, boolean, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_add_group_member(uuid, uuid, public.class_member_status, date, date, boolean, uuid)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_charge_month(p_user_id uuid, p_period date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', COALESCE(p_period, public.bs_tashkent_today()))::date;
  v_class uuid;
  v_added int := 0;
  v_priced int := 0;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_memberships WHERE user_id = p_user_id) THEN
    RAISE EXCEPTION 'Student is not in a class';
  END IF;
  FOR v_class IN
    SELECT class_id FROM public.class_memberships WHERE user_id = p_user_id
  LOOP
    IF COALESCE(public.bs_class_fee_for_month(v_class, v_month), 0) > 0 THEN
      v_priced := v_priced + 1;
      IF public._billing_charge_class_month(p_user_id, v_class, v_month, 'manual') IS NOT NULL THEN
        v_added := v_added + 1;
      END IF;
    END IF;
  END LOOP;
  IF v_priced = 0 THEN
    RAISE EXCEPTION 'no_priced_groups';
  END IF;
  RETURN v_added;
END;
$$;
