-- Sub-classes: every parent class has one Maths group (AFL) and one Eng group (VAR).
-- Parent memberships are derived from group memberships. Lessons, attendance and
-- homework are keyed to the group.

CREATE OR REPLACE FUNCTION public.bs_group_scheme(p_subject public.class_subject)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_subject WHEN 'math' THEN 'AFL' ELSE 'VAR' END;
$$;

REVOKE ALL ON FUNCTION public.bs_group_scheme(public.class_subject) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_group_scheme(public.class_subject) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.bs_group_default_name(p_class_name text, p_subject public.class_subject)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(p_class_name) || CASE p_subject WHEN 'math' THEN ' Maths' ELSE ' Eng' END;
$$;

REVOKE ALL ON FUNCTION public.bs_group_default_name(text, public.class_subject) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_group_default_name(text, public.class_subject) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.class_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  name text NOT NULL CHECK (btrim(name) <> ''),
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  schedule_days smallint[],
  start_time time,
  end_time time,
  room text,
  level text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT class_groups_one_per_subject UNIQUE (class_id, subject),
  CONSTRAINT class_groups_days_ok CHECK (
    schedule_days IS NULL OR schedule_days <@ ARRAY[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

DROP TRIGGER IF EXISTS class_groups_set_updated_at ON public.class_groups;
CREATE TRIGGER class_groups_set_updated_at
  BEFORE UPDATE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.class_groups (
  class_id, subject, name, teacher_id, schedule_days, start_time, end_time, room, level, active
)
SELECT
  c.id,
  s.subject,
  public.bs_group_default_name(c.name, s.subject),
  c.teacher_id,
  CASE s.subject WHEN 'math' THEN COALESCE(c.math_schedule_days, c.schedule_days)
                 ELSE COALESCE(c.ebrw_schedule_days, c.schedule_days) END,
  CASE s.subject WHEN 'math' THEN COALESCE(c.math_start_time, c.start_time)
                 ELSE COALESCE(c.ebrw_start_time, c.start_time) END,
  CASE s.subject WHEN 'math' THEN COALESCE(c.math_end_time, c.end_time)
                 ELSE COALESCE(c.ebrw_end_time, c.end_time) END,
  c.room,
  c.level,
  c.active
FROM public.classes c
CROSS JOIN (VALUES ('math'::public.class_subject), ('ebrw'::public.class_subject)) AS s(subject)
ON CONFLICT (class_id, subject) DO NOTHING;

COMMENT ON COLUMN public.classes.math_schedule_days IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';
COMMENT ON COLUMN public.classes.math_start_time IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';
COMMENT ON COLUMN public.classes.math_end_time IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';
COMMENT ON COLUMN public.classes.ebrw_schedule_days IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';
COMMENT ON COLUMN public.classes.ebrw_start_time IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';
COMMENT ON COLUMN public.classes.ebrw_end_time IS 'Deprecated: use class_groups. Dropped in the v2 cleanup step.';

CREATE OR REPLACE FUNCTION public.classes_create_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.class_groups (
    class_id, subject, name, teacher_id, schedule_days, start_time, end_time, room, level, active
  )
  SELECT
    NEW.id, s.subject, public.bs_group_default_name(NEW.name, s.subject), NEW.teacher_id,
    NEW.schedule_days, NEW.start_time, NEW.end_time, NEW.room, NEW.level, NEW.active
  FROM (VALUES ('math'::public.class_subject), ('ebrw'::public.class_subject)) AS s(subject)
  ON CONFLICT (class_id, subject) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_create_groups ON public.classes;
CREATE TRIGGER classes_create_groups
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_create_groups();

-- Renaming a parent renames groups that still carry the default name.
CREATE OR REPLACE FUNCTION public.classes_rename_groups()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name THEN
    UPDATE public.class_groups g
    SET name = public.bs_group_default_name(NEW.name, g.subject)
    WHERE g.class_id = NEW.id
      AND g.name = public.bs_group_default_name(OLD.name, g.subject);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_rename_groups ON public.classes;
CREATE TRIGGER classes_rename_groups
  AFTER UPDATE OF name ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_rename_groups();

CREATE OR REPLACE FUNCTION public.class_groups_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.classes c WHERE c.id = OLD.class_id) THEN
      RAISE EXCEPTION 'A sub-class cannot be deleted on its own. Delete the parent class instead.';
    END IF;
    RETURN OLD;
  END IF;
  IF NEW.class_id IS DISTINCT FROM OLD.class_id OR NEW.subject IS DISTINCT FROM OLD.subject THEN
    RAISE EXCEPTION 'A sub-class cannot change parent or subject';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_groups_guard ON public.class_groups;
CREATE TRIGGER class_groups_guard
  BEFORE UPDATE OR DELETE ON public.class_groups
  FOR EACH ROW EXECUTE FUNCTION public.class_groups_guard();

-- Group memberships ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.class_group_memberships (
  group_id uuid NOT NULL REFERENCES public.class_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  status public.class_member_status NOT NULL DEFAULT 'active',
  enrolled_on date NOT NULL DEFAULT public.bs_tashkent_today(),
  activated_on date,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS class_group_memberships_one_live_per_subject
  ON public.class_group_memberships (user_id, subject)
  WHERE status <> 'left';

CREATE INDEX IF NOT EXISTS class_group_memberships_user_idx
  ON public.class_group_memberships (user_id);

CREATE INDEX IF NOT EXISTS class_group_memberships_class_idx
  ON public.class_group_memberships (class_id, user_id);

ALTER TABLE public.class_membership_events
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'status';

ALTER TABLE public.class_membership_events DROP CONSTRAINT IF EXISTS class_membership_events_kind_ok;
ALTER TABLE public.class_membership_events
  ADD CONSTRAINT class_membership_events_kind_ok CHECK (kind IN ('status', 'activation'));

CREATE INDEX IF NOT EXISTS class_membership_events_group_idx
  ON public.class_membership_events (group_id, user_id, effective_on DESC, created_at DESC);

-- Internal: answer for any user. Callable only from SQL, never over the API.
CREATE OR REPLACE FUNCTION public._bs_group_member(_group_id uuid, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.group_id = _group_id AND m.user_id = _uid AND m.status <> 'left'
  );
$$;

CREATE OR REPLACE FUNCTION public._bs_in_class_subject(_class_id uuid, _subject public.class_subject, _uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.class_id = _class_id AND m.subject = _subject
      AND m.user_id = _uid AND m.status <> 'left'
  );
$$;

CREATE OR REPLACE FUNCTION public._bs_user_is_staff(_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin', 'editor')
  );
$$;

REVOKE ALL ON FUNCTION public._bs_group_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bs_in_class_subject(uuid, public.class_subject, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public._bs_user_is_staff(uuid) FROM PUBLIC, anon, authenticated;

-- Policy helpers: like bs_is_staff, they only answer for the caller.
CREATE OR REPLACE FUNCTION public.bs_is_group_member(_group_id uuid, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND public._bs_group_member(_group_id, _uid);
$$;

CREATE OR REPLACE FUNCTION public.bs_in_class_subject(
  _class_id uuid,
  _subject public.class_subject,
  _uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(_uid = auth.uid(), false) AND public._bs_in_class_subject(_class_id, _subject, _uid);
$$;

REVOKE ALL ON FUNCTION public.bs_is_group_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.bs_in_class_subject(uuid, public.class_subject, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.bs_is_group_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.bs_in_class_subject(uuid, public.class_subject, uuid) TO authenticated, service_role;

-- Parent row = union of live group rows; status = strongest live status.
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

  IF EXISTS (
    SELECT 1 FROM public.class_memberships
    WHERE user_id = p_user_id AND class_id <> p_class_id
  ) THEN
    RAISE EXCEPTION 'This student is already in another class. Move them instead.';
  END IF;

  INSERT INTO public.class_memberships (class_id, user_id, status, enrolled_on)
  VALUES (p_class_id, p_user_id, v_status, v_enrolled)
  ON CONFLICT (class_id, user_id) DO UPDATE
    SET status = EXCLUDED.status
    WHERE class_memberships.status IS DISTINCT FROM EXCLUDED.status;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_sync_parent_membership(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.class_group_memberships_fill()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group public.class_groups%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.group_id IS DISTINCT FROM OLD.group_id OR NEW.user_id IS DISTINCT FROM OLD.user_id) THEN
    RAISE EXCEPTION 'Move a student with the move action, not by editing the row';
  END IF;
  IF NEW.status = 'left' THEN
    RAISE EXCEPTION 'Remove the student from the sub-class instead of marking them left';
  END IF;
  SELECT * INTO v_group FROM public.class_groups WHERE id = NEW.group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  NEW.class_id := v_group.class_id;
  NEW.subject := v_group.subject;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_group_memberships_fill ON public.class_group_memberships;
CREATE TRIGGER class_group_memberships_fill
  BEFORE INSERT OR UPDATE ON public.class_group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_group_memberships_fill();

CREATE OR REPLACE FUNCTION public.class_group_memberships_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.enrolled_on, auth.uid());
    PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    INSERT INTO public.chat_thread_members (thread_id, user_id)
    SELECT t.id, NEW.user_id
    FROM public.chat_threads t
    WHERE t.class_id = NEW.class_id AND t.kind = 'subject_group' AND t.subject = NEW.subject
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, public.bs_tashkent_today(), auth.uid());
      PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    END IF;
    IF NEW.activated_on IS DISTINCT FROM OLD.activated_on AND NEW.activated_on IS NOT NULL THEN
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by, kind)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.activated_on, auth.uid(), 'activation');
    END IF;
    RETURN NEW;
  ELSE
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    SELECT OLD.user_id, OLD.class_id, OLD.group_id, 'left', public.bs_tashkent_today(), auth.uid()
    WHERE EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = OLD.group_id)
      AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = OLD.class_id);
    PERFORM public.bs_sync_parent_membership(OLD.class_id, OLD.user_id);
    DELETE FROM public.chat_thread_members m
    USING public.chat_threads t
    WHERE m.thread_id = t.id
      AND m.user_id = OLD.user_id
      AND t.class_id = OLD.class_id
      AND t.kind = 'subject_group'
      AND t.subject = OLD.subject
      AND NOT public._bs_user_is_staff(OLD.user_id);
    RETURN OLD;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS class_group_memberships_after ON public.class_group_memberships;
CREATE TRIGGER class_group_memberships_after
  AFTER INSERT OR UPDATE OR DELETE ON public.class_group_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_group_memberships_after();

-- Direct parent inserts (account creation, join_class, legacy RPCs) join both groups.
CREATE OR REPLACE FUNCTION public.class_memberships_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_class_threads(NEW.class_id);

  UPDATE public.profiles SET class_id = NEW.class_id WHERE id = NEW.user_id;

  INSERT INTO public.chat_thread_members (thread_id, user_id)
  SELECT t.id, NEW.user_id
  FROM public.chat_threads t
  WHERE t.class_id = NEW.class_id AND t.kind = 'class_group'
  ON CONFLICT DO NOTHING;

  IF NEW.status <> 'left' AND NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships m
    WHERE m.class_id = NEW.class_id AND m.user_id = NEW.user_id
  ) THEN
    INSERT INTO public.class_group_memberships (group_id, user_id, class_id, subject, status, enrolled_on, activated_on)
    SELECT g.id, NEW.user_id, g.class_id, g.subject, NEW.status, NEW.enrolled_on, NEW.enrolled_on
    FROM public.class_groups g
    WHERE g.class_id = NEW.class_id
    ON CONFLICT (group_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.class_memberships_after_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
     SET class_id = NULL
   WHERE id = OLD.user_id AND class_id = OLD.class_id;

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

ALTER TABLE public.class_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_group_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups read staff or member" ON public.class_groups;
CREATE POLICY "groups read staff or member" ON public.class_groups
  FOR SELECT TO authenticated
  USING (public.bs_is_staff() OR public.bs_is_group_member(id));

DROP POLICY IF EXISTS "groups staff update" ON public.class_groups;
CREATE POLICY "groups staff update" ON public.class_groups
  FOR UPDATE TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT, UPDATE ON public.class_groups TO authenticated;
REVOKE INSERT, DELETE ON public.class_groups FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.class_groups TO service_role;

DROP POLICY IF EXISTS "group memberships read own or staff" ON public.class_group_memberships;
CREATE POLICY "group memberships read own or staff" ON public.class_group_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

GRANT SELECT ON public.class_group_memberships TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.class_group_memberships FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.class_group_memberships TO service_role;

-- Subject chats are for that sub-class only.
DROP POLICY IF EXISTS "threads read members" ON public.chat_threads;
CREATE POLICY "threads read members" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_thread_member(id)
    OR (kind = 'class_group' AND class_id IS NOT NULL AND public.bs_is_class_member(class_id))
    OR (kind = 'subject_group' AND class_id IS NOT NULL AND subject IS NOT NULL
        AND public.bs_in_class_subject(class_id, subject))
  );

DROP POLICY IF EXISTS "thread members insert self" ON public.chat_thread_members;
CREATE POLICY "thread members insert self" ON public.chat_thread_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.chat_threads t
        WHERE t.id = chat_thread_members.thread_id
          AND (
            (t.kind = 'class_group' AND t.class_id IS NOT NULL AND public.bs_is_class_member(t.class_id))
            OR (t.kind = 'subject_group' AND t.class_id IS NOT NULL AND t.subject IS NOT NULL
                AND public.bs_in_class_subject(t.class_id, t.subject))
            OR (t.kind = 'direct' AND t.created_by = auth.uid())
          )
      )
    )
  );

-- Re-key per-lesson data to the group -----------------------------------------

ALTER TABLE public.class_lessons
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE;
ALTER TABLE public.lesson_attendance
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE;
ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.class_groups(id) ON DELETE CASCADE;

UPDATE public.class_lessons l SET group_id = g.id
FROM public.class_groups g
WHERE l.group_id IS NULL AND g.class_id = l.class_id AND g.subject = l.subject;

UPDATE public.lesson_attendance a SET group_id = g.id
FROM public.class_groups g
WHERE a.group_id IS NULL AND g.class_id = a.class_id AND g.subject = a.subject;

UPDATE public.homework_assignments h SET group_id = g.id
FROM public.class_groups g
WHERE h.group_id IS NULL AND g.class_id = h.class_id AND g.subject = h.subject;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.class_lessons WHERE group_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.lesson_attendance WHERE group_id IS NULL)
     OR EXISTS (SELECT 1 FROM public.homework_assignments WHERE group_id IS NULL) THEN
    RAISE EXCEPTION 'Rows without a subject cannot be mapped to a sub-class. Fix them first.';
  END IF;
END $$;

-- Rows written by older code with (class_id, subject) get their group filled in.
CREATE OR REPLACE FUNCTION public.bs_fill_group_keys()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group public.class_groups%ROWTYPE;
BEGIN
  IF NEW.group_id IS NULL THEN
    SELECT * INTO v_group FROM public.class_groups
    WHERE class_id = NEW.class_id AND subject = NEW.subject;
  ELSE
    SELECT * INTO v_group FROM public.class_groups WHERE id = NEW.group_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pick a sub-class (Maths or Eng) first';
  END IF;
  NEW.group_id := v_group.id;
  NEW.class_id := v_group.class_id;
  NEW.subject := v_group.subject;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_lessons_fill_group ON public.class_lessons;
CREATE TRIGGER class_lessons_fill_group
  BEFORE INSERT OR UPDATE OF group_id, class_id, subject ON public.class_lessons
  FOR EACH ROW EXECUTE FUNCTION public.bs_fill_group_keys();

DROP TRIGGER IF EXISTS lesson_attendance_fill_group ON public.lesson_attendance;
CREATE TRIGGER lesson_attendance_fill_group
  BEFORE INSERT OR UPDATE OF group_id, class_id, subject ON public.lesson_attendance
  FOR EACH ROW EXECUTE FUNCTION public.bs_fill_group_keys();

DROP TRIGGER IF EXISTS homework_assignments_fill_group ON public.homework_assignments;
CREATE TRIGGER homework_assignments_fill_group
  BEFORE INSERT OR UPDATE OF group_id, class_id, subject ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.bs_fill_group_keys();

ALTER TABLE public.class_lessons ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.lesson_attendance ALTER COLUMN group_id SET NOT NULL;
ALTER TABLE public.homework_assignments ALTER COLUMN group_id SET NOT NULL;

DROP INDEX IF EXISTS public.class_lessons_slot_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS class_lessons_group_date_uidx
  ON public.class_lessons (group_id, lesson_date);

ALTER TABLE public.lesson_attendance DROP CONSTRAINT IF EXISTS lesson_attendance_uniq_nulls;
DROP INDEX IF EXISTS public.lesson_attendance_uniq_nulls;
CREATE UNIQUE INDEX IF NOT EXISTS lesson_attendance_group_slot_uidx
  ON public.lesson_attendance (group_id, user_id, lesson_date);

CREATE INDEX IF NOT EXISTS homework_assignments_group_idx
  ON public.homework_assignments (group_id, created_at DESC);

DROP POLICY IF EXISTS "class lessons read" ON public.class_lessons;
CREATE POLICY "class lessons read" ON public.class_lessons
  FOR SELECT TO authenticated
  USING (public.bs_is_staff() OR public.bs_is_group_member(group_id));

DROP POLICY IF EXISTS "hw read class or staff" ON public.homework_assignments;
CREATE POLICY "hw read class or staff" ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (public.bs_is_staff() OR public.bs_is_group_member(group_id));

-- Lessons and attendance RPCs -----------------------------------------------

CREATE OR REPLACE FUNCTION public._bs_ensure_group_lessons(p_group_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.class_groups%ROWTYPE;
  v_day date;
  v_end date;
  v_added int := 0;
BEGIN
  SELECT * INTO v_group FROM public.class_groups WHERE id = p_group_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
  IF v_group.schedule_days IS NULL OR cardinality(v_group.schedule_days) = 0 THEN
    RETURN 0;
  END IF;
  v_day := date_trunc('month', p_month)::date;
  v_end := (v_day + interval '1 month' - interval '1 day')::date;
  WHILE v_day <= v_end LOOP
    IF EXTRACT(ISODOW FROM v_day)::smallint = ANY (v_group.schedule_days) THEN
      INSERT INTO public.class_lessons (group_id, class_id, subject, lesson_date, created_by)
      VALUES (v_group.id, v_group.class_id, v_group.subject, v_day, auth.uid())
      ON CONFLICT (group_id, lesson_date) DO NOTHING;
      IF FOUND THEN
        v_added := v_added + 1;
      END IF;
    END IF;
    v_day := v_day + 1;
  END LOOP;
  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public._bs_ensure_group_lessons(uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.ensure_group_lessons(p_group_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  RETURN public._bs_ensure_group_lessons(p_group_id, p_month);
END;
$$;

REVOKE ALL ON FUNCTION public.ensure_group_lessons(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_group_lessons(uuid, date) TO authenticated;

CREATE OR REPLACE FUNCTION public.ensure_class_lessons(p_class_id uuid, p_month date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_added int := 0;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  FOR v_group IN SELECT id FROM public.class_groups WHERE class_id = p_class_id LOOP
    v_added := v_added + public._bs_ensure_group_lessons(v_group, p_month);
  END LOOP;
  RETURN v_added;
END;
$$;

CREATE OR REPLACE FUNCTION public._bs_set_group_attendance(
  p_group_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_state NOT IN ('present', 'absent', 'empty') THEN
    RAISE EXCEPTION 'Attendance state must be present, absent, or empty';
  END IF;
  IF p_state = 'empty' THEN
    DELETE FROM public.lesson_attendance
    WHERE group_id = p_group_id AND user_id = p_user_id AND lesson_date = p_lesson_date;
    RETURN;
  END IF;
  INSERT INTO public.lesson_attendance (group_id, user_id, lesson_date, participated, marked_by)
  VALUES (p_group_id, p_user_id, p_lesson_date, p_state = 'present', auth.uid())
  ON CONFLICT (group_id, user_id, lesson_date)
  DO UPDATE SET participated = EXCLUDED.participated, marked_by = EXCLUDED.marked_by;
END;
$$;

REVOKE ALL ON FUNCTION public._bs_set_group_attendance(uuid, uuid, date, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.set_group_attendance(
  p_group_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_state text
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
  PERFORM public._bs_set_group_attendance(p_group_id, p_user_id, p_lesson_date, p_state);
END;
$$;

REVOKE ALL ON FUNCTION public.set_group_attendance(uuid, uuid, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_group_attendance(uuid, uuid, date, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_attendance(
  p_class_id uuid,
  p_user_id uuid,
  p_lesson_date date,
  p_subject public.class_subject,
  p_state text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT id INTO v_group FROM public.class_groups WHERE class_id = p_class_id AND subject = p_subject;
  IF v_group IS NULL THEN
    RAISE EXCEPTION 'Pick a sub-class (Maths or Eng) first';
  END IF;
  PERFORM public._bs_set_group_attendance(v_group, p_user_id, p_lesson_date, p_state);
END;
$$;

-- Membership RPCs -------------------------------------------------------------

CREATE OR REPLACE FUNCTION public._bs_upsert_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status,
  p_enrolled_on date,
  p_activated_on date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.class_group_memberships%ROWTYPE;
  v_enrolled date := COALESCE(p_enrolled_on, public.bs_tashkent_today());
BEGIN
  IF p_status = 'left' THEN
    DELETE FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id;
    RETURN;
  END IF;
  SELECT * INTO v_existing FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF FOUND THEN
    UPDATE public.class_group_memberships
    SET status = p_status,
        enrolled_on = COALESCE(p_enrolled_on, enrolled_on)
    WHERE group_id = p_group_id AND user_id = p_user_id;
    RETURN;
  END IF;
  BEGIN
    INSERT INTO public.class_group_memberships (group_id, user_id, class_id, subject, status, enrolled_on, activated_on)
    SELECT g.id, p_user_id, g.class_id, g.subject, p_status, v_enrolled, COALESCE(p_activated_on, v_enrolled)
    FROM public.class_groups g
    WHERE g.id = p_group_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'This student is already in another sub-class for that subject.';
  END;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sub-class not found';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._bs_upsert_group_member(uuid, uuid, public.class_member_status, date, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_add_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT 'active',
  p_enrolled_on date DEFAULT NULL,
  p_activated_on date DEFAULT NULL,
  p_move boolean DEFAULT false
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_class uuid;
  v_other uuid;
  v_existing public.class_group_memberships%ROWTYPE;
BEGIN
  IF NOT public.bs_is_staff() THEN
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

  SELECT class_id INTO v_other FROM public.class_memberships
  WHERE user_id = p_user_id AND class_id <> v_class;
  IF v_other IS NOT NULL THEN
    IF NOT p_move THEN
      RAISE EXCEPTION 'already_in_other_class';
    END IF;
    DELETE FROM public.class_memberships WHERE user_id = p_user_id AND class_id = v_other;
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

REVOKE ALL ON FUNCTION public.staff_add_group_member(uuid, uuid, public.class_member_status, date, date, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_add_group_member(uuid, uuid, public.class_member_status, date, date, boolean)
  TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_set_group_member_status(
  p_group_id uuid,
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
  IF NOT EXISTS (
    SELECT 1 FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, NULL, NULL);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_set_group_member_status(uuid, uuid, public.class_member_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_set_group_member_status(uuid, uuid, public.class_member_status) TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_remove_group_member(p_group_id uuid, p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  DELETE FROM public.class_group_memberships WHERE group_id = p_group_id AND user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_remove_group_member(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_remove_group_member(uuid, uuid) TO authenticated;

-- v1 signature: sets the status in every group the student is in.
CREATE OR REPLACE FUNCTION public.staff_set_member_status(
  p_user_id uuid,
  p_status public.class_member_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group uuid;
  v_found boolean := false;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  FOR v_group IN SELECT group_id FROM public.class_group_memberships WHERE user_id = p_user_id LOOP
    v_found := true;
    PERFORM public._bs_upsert_group_member(v_group, p_user_id, p_status, NULL, NULL);
  END LOOP;
  IF NOT v_found THEN
    RAISE EXCEPTION 'Student is not in a class';
  END IF;
END;
$$;

-- v1 signature: puts the student in both groups of the class.
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
  v_group uuid;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class_id) THEN
    RAISE EXCEPTION 'That class group was not found.';
  END IF;
  FOR v_group IN SELECT id FROM public.class_groups WHERE class_id = p_class_id ORDER BY subject LOOP
    PERFORM public.staff_add_group_member(v_group, p_user_id, p_status, p_enrolled_on, NULL, true);
  END LOOP;
END;
$$;
