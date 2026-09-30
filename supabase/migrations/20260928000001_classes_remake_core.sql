-- Classes remake: roster fields, membership status history, student phones.

DO $$ BEGIN
  CREATE TYPE public.class_member_status AS ENUM ('active', 'trial', 'frozen', 'left');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION public.bs_tashkent_today()
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (now() AT TIME ZONE 'Asia/Tashkent')::date;
$$;

REVOKE ALL ON FUNCTION public.bs_tashkent_today() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_tashkent_today() TO authenticated, service_role;

ALTER TABLE public.classes
  ADD COLUMN IF NOT EXISTS schedule_days smallint[],
  ADD COLUMN IF NOT EXISTS start_time time,
  ADD COLUMN IF NOT EXISTS end_time time,
  ADD COLUMN IF NOT EXISTS room text,
  ADD COLUMN IF NOT EXISTS level text,
  ADD COLUMN IF NOT EXISTS teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS starts_on date;

ALTER TABLE public.classes DROP CONSTRAINT IF EXISTS classes_schedule_days_ok;
ALTER TABLE public.classes
  ADD CONSTRAINT classes_schedule_days_ok
  CHECK (
    schedule_days IS NULL
    OR schedule_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

ALTER TABLE public.class_memberships
  ADD COLUMN IF NOT EXISTS status public.class_member_status NOT NULL DEFAULT 'active';

ALTER TABLE public.class_memberships
  ADD COLUMN IF NOT EXISTS enrolled_on date;

UPDATE public.class_memberships
SET enrolled_on = (joined_at AT TIME ZONE 'Asia/Tashkent')::date
WHERE enrolled_on IS NULL;

ALTER TABLE public.class_memberships
  ALTER COLUMN enrolled_on SET DEFAULT public.bs_tashkent_today();

ALTER TABLE public.class_memberships
  ALTER COLUMN enrolled_on SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.class_membership_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  status public.class_member_status NOT NULL,
  effective_on date NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_membership_events_user_idx
  ON public.class_membership_events (user_id, effective_on DESC, created_at DESC);

INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on)
SELECT m.user_id, m.class_id, m.status, m.enrolled_on
FROM public.class_memberships m
WHERE NOT EXISTS (
  SELECT 1 FROM public.class_membership_events e
  WHERE e.user_id = m.user_id AND e.class_id = m.class_id
);

CREATE OR REPLACE FUNCTION public.class_memberships_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
    VALUES (
      NEW.user_id,
      NEW.class_id,
      NEW.status,
      COALESCE(NEW.enrolled_on, public.bs_tashkent_today()),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
      VALUES (NEW.user_id, NEW.class_id, NEW.status, public.bs_tashkent_today(), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
    VALUES (OLD.user_id, OLD.class_id, 'left', public.bs_tashkent_today(), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS class_memberships_log_insert ON public.class_memberships;
CREATE TRIGGER class_memberships_log_insert
  AFTER INSERT ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_memberships_log_event();

DROP TRIGGER IF EXISTS class_memberships_log_status ON public.class_memberships;
CREATE TRIGGER class_memberships_log_status
  AFTER UPDATE OF status ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_memberships_log_event();

DROP TRIGGER IF EXISTS class_memberships_log_delete ON public.class_memberships;
CREATE TRIGGER class_memberships_log_delete
  AFTER DELETE ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_memberships_log_event();

DROP FUNCTION IF EXISTS public.admin_set_class_member(uuid, uuid);

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

  SELECT m.class_id INTO v_class
  FROM public.class_memberships m
  WHERE m.user_id = p_user_id;

  IF v_class = p_class_id THEN
    UPDATE public.class_memberships
    SET status = p_status,
        enrolled_on = COALESCE(p_enrolled_on, enrolled_on)
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

GRANT UPDATE ON public.class_memberships TO authenticated;

DROP POLICY IF EXISTS "memberships update staff" ON public.class_memberships;
CREATE POLICY "memberships update staff" ON public.class_memberships
  FOR UPDATE TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

ALTER TABLE public.class_membership_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "membership events read" ON public.class_membership_events;
CREATE POLICY "membership events read" ON public.class_membership_events
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

GRANT SELECT ON public.class_membership_events TO authenticated;
GRANT ALL ON public.class_membership_events TO service_role;
REVOKE INSERT, UPDATE, DELETE ON public.class_membership_events FROM authenticated, anon, PUBLIC;

CREATE TABLE IF NOT EXISTS public.student_contacts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text,
  parent_phone text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "student contacts staff read" ON public.student_contacts;
CREATE POLICY "student contacts staff read" ON public.student_contacts
  FOR SELECT TO authenticated
  USING (public.bs_is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "student contacts admin write" ON public.student_contacts;
CREATE POLICY "student contacts admin write" ON public.student_contacts
  FOR ALL TO authenticated
  USING (public.bs_is_admin())
  WITH CHECK (public.bs_is_admin());

GRANT SELECT ON public.student_contacts TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.student_contacts TO authenticated;
GRANT ALL ON public.student_contacts TO service_role;
REVOKE ALL ON public.student_contacts FROM anon, PUBLIC;
