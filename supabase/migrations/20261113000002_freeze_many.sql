-- Freeze or activate every listed sub-class in one transaction.
-- A failure on any sub-class undoes the others. Activating someone who is
-- already back is a no-op, so the call can be repeated.

CREATE OR REPLACE FUNCTION public.staff_freeze_group_members(
  p_group_ids uuid[],
  p_user_id uuid,
  p_frozen_on date,
  p_resumes_on date DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF p_group_ids IS NULL OR cardinality(p_group_ids) = 0 THEN
    RAISE EXCEPTION 'Choose a sub-class';
  END IF;
  FOREACH v_group IN ARRAY p_group_ids LOOP
    PERFORM public.staff_freeze_group_member(v_group, p_user_id, p_frozen_on, p_resumes_on, p_reason);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_activate_group_members(
  p_group_ids uuid[],
  p_user_id uuid,
  p_status public.class_member_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_row public.class_group_memberships%ROWTYPE;
BEGIN
  IF p_group_ids IS NULL OR cardinality(p_group_ids) = 0 THEN
    RAISE EXCEPTION 'Choose a sub-class';
  END IF;
  FOREACH v_group IN ARRAY p_group_ids LOOP
    SELECT * INTO v_row
    FROM public.class_group_memberships
    WHERE group_id = v_group AND user_id = p_user_id;
    IF NOT FOUND OR v_row.status = 'left' THEN
      RAISE EXCEPTION 'Student is not in this sub-class';
    END IF;
    IF v_row.status <> 'frozen' AND v_row.frozen_on IS NULL THEN
      CONTINUE;
    END IF;
    PERFORM public.staff_activate_group_member(v_group, p_user_id, p_status);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_freeze_group_members(uuid[], uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_freeze_group_members(uuid[], uuid, date, date, text) TO authenticated;

REVOKE ALL ON FUNCTION public.staff_activate_group_members(uuid[], uuid, public.class_member_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_activate_group_members(uuid[], uuid, public.class_member_status) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261113000002', 'freeze_many')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
