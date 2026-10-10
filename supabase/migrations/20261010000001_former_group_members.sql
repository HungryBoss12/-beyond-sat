-- Teachers could not read membership history for a group they teach, so a
-- student who left or was moved vanished from the roster. Staff already can.
-- The function also returns the classes they attend now; a teacher cannot see
-- those membership rows directly.

DROP POLICY IF EXISTS "membership events read" ON public.class_membership_events;
CREATE POLICY "membership events read" ON public.class_membership_events
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.bs_is_staff()
    OR (group_id IS NOT NULL AND public.bs_teaches_group(group_id))
  );

DROP POLICY IF EXISTS "teachers read former students" ON public.profiles;
CREATE POLICY "teachers read former students" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.class_membership_events e
      JOIN public.class_groups g ON g.id = e.group_id
      WHERE e.user_id = profiles.id
        AND e.status = 'left'
        AND g.teacher_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.group_former_members(p_group_id uuid)
RETURNS TABLE (user_id uuid, effective_on date, moved_to text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.class_groups WHERE id = p_group_id) THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;

  RETURN QUERY
  SELECT e.user_id, e.effective_on, dest.moved_to
  FROM (
    SELECT DISTINCT ON (ev.user_id)
      ev.user_id,
      ev.effective_on
    FROM public.class_membership_events ev
    WHERE ev.group_id = p_group_id
      AND ev.status = 'left'
      AND ev.kind = 'status'
      AND NOT EXISTS (
        SELECT 1
        FROM public.class_group_memberships live
        WHERE live.group_id = p_group_id
          AND live.user_id = ev.user_id
      )
    ORDER BY ev.user_id, ev.created_at DESC
  ) e
  LEFT JOIN LATERAL (
    SELECT NULLIF(string_agg(DISTINCT g.name, ', ' ORDER BY g.name), '') AS moved_to
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = e.user_id
      AND m.group_id <> p_group_id
  ) dest ON true;
END;
$$;

REVOKE ALL ON FUNCTION public.group_former_members(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.group_former_members(uuid) TO authenticated, service_role;
