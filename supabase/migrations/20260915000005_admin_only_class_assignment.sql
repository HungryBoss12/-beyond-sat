-- Class assignment is admin-only: students may no longer self-enroll via join_class
-- or by inserting into class_memberships. Also lock profiles.class_id for non-staff.

CREATE OR REPLACE FUNCTION public.join_class(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Staff can still call this for convenience; students must be assigned by an admin.
  IF public.bs_is_staff() THEN
    IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class_id AND c.active) THEN
      RAISE EXCEPTION 'Class not found';
    END IF;
    DELETE FROM public.class_memberships WHERE user_id = auth.uid();
    INSERT INTO public.class_memberships (class_id, user_id)
    VALUES (p_class_id, auth.uid())
    ON CONFLICT DO NOTHING;
    RETURN;
  END IF;

  RAISE EXCEPTION 'Class assignment is admin-only. Ask your teacher to add you to a group.';
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class(uuid) TO authenticated;

DROP POLICY IF EXISTS "memberships insert own or staff" ON public.class_memberships;
CREATE POLICY "memberships insert own or staff" ON public.class_memberships
  FOR INSERT TO authenticated
  WITH CHECK (public.bs_is_staff());

CREATE OR REPLACE FUNCTION public.bs_lock_profile_security_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' OR public.bs_is_staff() THEN
    RETURN NEW;
  END IF;

  NEW.banned := OLD.banned;
  NEW.banned_at := OLD.banned_at;
  NEW.banned_reason := OLD.banned_reason;
  -- Class membership is synced from class_memberships by triggers (definer);
  -- students must not set class_id themselves.
  NEW.class_id := OLD.class_id;

  IF current_setting('beyondsat.clear_must_change', true) IS DISTINCT FROM 'on' THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  ELSIF NOT (OLD.must_change_credentials IS TRUE AND NEW.must_change_credentials IS FALSE) THEN
    NEW.must_change_credentials := OLD.must_change_credentials;
  END IF;

  RETURN NEW;
END;
$$;
