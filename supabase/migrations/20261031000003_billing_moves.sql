-- A student studies a subject in one class at a time, so a subject is never billed twice.
-- A move into a group the student already sits in starts that group on the move date.

CREATE OR REPLACE FUNCTION public.class_group_memberships_one_subject()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_other text;
BEGIN
  SELECT c.name INTO v_other
  FROM public.class_group_memberships m
  JOIN public.classes c ON c.id = m.class_id
  WHERE m.user_id = NEW.user_id
    AND m.subject = NEW.subject
    AND m.class_id <> NEW.class_id
    AND c.archived_at IS NULL
  LIMIT 1;
  IF v_other IS NOT NULL THEN
    RAISE EXCEPTION 'This student already studies % in %. Move the student instead.',
      CASE WHEN NEW.subject = 'math' THEN 'Math' ELSE 'English' END, v_other;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_group_memberships_one_subject ON public.class_group_memberships;
CREATE TRIGGER class_group_memberships_one_subject
BEFORE INSERT ON public.class_group_memberships
FOR EACH ROW EXECUTE FUNCTION public.class_group_memberships_one_subject();

CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status class_member_status DEFAULT 'active'::class_member_status,
  p_enrolled_on date DEFAULT NULL::date,
  p_activated_on date DEFAULT NULL::date,
  p_move boolean DEFAULT false,
  p_from_class_id uuid DEFAULT NULL::uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_existing public.class_group_memberships%ROWTYPE;
  v_found boolean;
  v_join date;
  v_old uuid;
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_move AND NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  SELECT class_id INTO v_class FROM public.class_groups WHERE id = p_group_id;
  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;

  IF p_move THEN
    v_join := COALESCE(p_activated_on, p_enrolled_on, public.bs_tashkent_today());
    FOR v_old IN
      SELECT DISTINCT m.class_id
      FROM public.class_memberships m
      WHERE m.user_id = p_user_id
        AND m.class_id <> v_class
        AND (p_from_class_id IS NULL OR m.class_id = p_from_class_id)
    LOOP
      PERFORM public._billing_close_class_before(p_user_id, v_old, v_join);
    END LOOP;
    DELETE FROM public.class_memberships
    WHERE user_id = p_user_id
      AND class_id <> v_class
      AND (p_from_class_id IS NULL OR class_id = p_from_class_id);
  END IF;

  SELECT * INTO v_existing FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  v_found := FOUND;
  IF v_found AND p_enrolled_on IS NOT NULL AND p_enrolled_on IS DISTINCT FROM v_existing.enrolled_on
     AND NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;

  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, p_enrolled_on, p_activated_on);

  -- The old class was billed through the day before the move, so this group starts on it.
  IF p_move AND v_found
     AND COALESCE(v_existing.activated_on, v_existing.enrolled_on) < v_join THEN
    UPDATE public.class_group_memberships
    SET activated_on = v_join
    WHERE group_id = p_group_id AND user_id = p_user_id;
  END IF;

  IF p_move OR p_status <> 'left' THEN
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261031000003', 'billing_moves')
ON CONFLICT (version) DO NOTHING;
