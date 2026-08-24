-- =====================================================================
-- Classes: groups, chat profiles, messaging, homework, lesson attendance
-- Idempotent where practical. Uses public.bs_is_admin / bs_is_editor.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.class_subject AS ENUM ('math', 'ebrw');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.chat_thread_kind AS ENUM ('subject_group', 'class_group', 'direct');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.homework_submission_status AS ENUM ('pending', 'submitted', 'reviewed', 'accepted', 'needs_revision');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- Profile fields for Classes / chat setup
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS telegram_username text,
  ADD COLUMN IF NOT EXISTS telegram_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS chat_setup_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS class_id uuid;

-- Unique username (case-insensitive) when set
CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_lower_uidx
  ON public.profiles (lower(username))
  WHERE username IS NOT NULL;

-- ---------------------------------------------------------------------
-- Classes (groups)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classes_active_idx ON public.classes (active, name);

DROP TRIGGER IF EXISTS classes_set_updated_at ON public.classes;
CREATE TRIGGER classes_set_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_class_id_fkey;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_class_id_fkey
  FOREIGN KEY (class_id) REFERENCES public.classes(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.class_memberships (
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (class_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS class_memberships_one_class_per_user
  ON public.class_memberships (user_id);

CREATE INDEX IF NOT EXISTS class_memberships_class_idx ON public.class_memberships (class_id);

-- ---------------------------------------------------------------------
-- Chat threads / messages
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind public.chat_thread_kind NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  subject public.class_subject,
  title text NOT NULL,
  pinned boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_threads_subject_group_ok CHECK (
    (kind = 'subject_group' AND class_id IS NOT NULL AND subject IS NOT NULL)
    OR (kind = 'class_group' AND class_id IS NOT NULL AND subject IS NULL)
    OR (kind = 'direct' AND class_id IS NULL AND subject IS NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_subject_unique
  ON public.chat_threads (class_id, subject)
  WHERE kind = 'subject_group';

CREATE UNIQUE INDEX IF NOT EXISTS chat_threads_class_group_unique
  ON public.chat_threads (class_id)
  WHERE kind = 'class_group';

CREATE INDEX IF NOT EXISTS chat_threads_kind_idx ON public.chat_threads (kind, updated_at DESC);

DROP TRIGGER IF EXISTS chat_threads_set_updated_at ON public.chat_threads;
CREATE TRIGGER chat_threads_set_updated_at
  BEFORE UPDATE ON public.chat_threads
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.chat_thread_members (
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_read_at timestamptz,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (thread_id, user_id)
);

CREATE INDEX IF NOT EXISTS chat_thread_members_user_idx
  ON public.chat_thread_members (user_id, thread_id);

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS chat_messages_thread_created_idx
  ON public.chat_messages (thread_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.chat_message_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  byte_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_message_attachments_message_idx
  ON public.chat_message_attachments (message_id);

-- ---------------------------------------------------------------------
-- Homework
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  subject public.class_subject NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  due_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homework_assignments_class_subject_idx
  ON public.homework_assignments (class_id, subject, due_at DESC NULLS LAST);

DROP TRIGGER IF EXISTS homework_assignments_set_updated_at ON public.homework_assignments;
CREATE TRIGGER homework_assignments_set_updated_at
  BEFORE UPDATE ON public.homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.homework_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  byte_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homework_files_assignment_idx
  ON public.homework_files (assignment_id);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.homework_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL DEFAULT '',
  status public.homework_submission_status NOT NULL DEFAULT 'submitted',
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS homework_submissions_student_idx
  ON public.homework_submissions (student_id, created_at DESC);

DROP TRIGGER IF EXISTS homework_submissions_set_updated_at ON public.homework_submissions;
CREATE TRIGGER homework_submissions_set_updated_at
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.homework_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.homework_submissions(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  file_name text NOT NULL,
  mime_type text,
  byte_size bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS homework_submission_files_submission_idx
  ON public.homework_submission_files (submission_id);

-- ---------------------------------------------------------------------
-- Lesson attendance (GitHub-style grid)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.lesson_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject public.class_subject,
  lesson_date date NOT NULL,
  participated boolean NOT NULL DEFAULT true,
  note text,
  marked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, user_id, lesson_date, subject)
);

CREATE INDEX IF NOT EXISTS lesson_attendance_user_date_idx
  ON public.lesson_attendance (user_id, lesson_date DESC);

CREATE INDEX IF NOT EXISTS lesson_attendance_class_date_idx
  ON public.lesson_attendance (class_id, lesson_date DESC);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.bs_user_class_id(_uid uuid DEFAULT auth.uid())
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT class_id FROM public.class_memberships WHERE user_id = _uid LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.bs_is_class_member(_class_id uuid, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.class_memberships m
    WHERE m.class_id = _class_id AND m.user_id = _uid
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_is_thread_member(_thread_id uuid, _uid uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.chat_thread_members m
    WHERE m.thread_id = _thread_id AND m.user_id = _uid
  )
  OR public.bs_is_staff(_uid);
$$;

GRANT EXECUTE ON FUNCTION public.bs_user_class_id(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_class_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_is_thread_member(uuid, uuid) TO authenticated;

-- Ensure subject + class group threads exist for a class
CREATE OR REPLACE FUNCTION public.ensure_class_threads(p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cname text;
BEGIN
  SELECT name INTO cname FROM public.classes WHERE id = p_class_id;
  IF cname IS NULL THEN RETURN; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE class_id = p_class_id AND kind = 'subject_group' AND subject = 'math'
  ) THEN
    INSERT INTO public.chat_threads (kind, class_id, subject, title, pinned)
    VALUES ('subject_group', p_class_id, 'math', 'Maths', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE class_id = p_class_id AND kind = 'subject_group' AND subject = 'ebrw'
  ) THEN
    INSERT INTO public.chat_threads (kind, class_id, subject, title, pinned)
    VALUES ('subject_group', p_class_id, 'ebrw', 'EBRW', true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.chat_threads
    WHERE class_id = p_class_id AND kind = 'class_group'
  ) THEN
    INSERT INTO public.chat_threads (kind, class_id, subject, title, pinned)
    VALUES ('class_group', p_class_id, NULL, cname || ' · Class', false);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ensure_class_threads(uuid) TO authenticated;

-- When a class is created, seed threads
CREATE OR REPLACE FUNCTION public.classes_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.ensure_class_threads(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS classes_after_insert ON public.classes;
CREATE TRIGGER classes_after_insert
  AFTER INSERT ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.classes_after_insert();

-- Join student to class group threads when membership is added
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
  WHERE t.class_id = NEW.class_id AND t.kind IN ('subject_group', 'class_group')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS class_memberships_after_insert ON public.class_memberships;
CREATE TRIGGER class_memberships_after_insert
  AFTER INSERT ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_memberships_after_insert();

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

  DELETE FROM public.chat_thread_members m
  USING public.chat_threads t
  WHERE m.thread_id = t.id
    AND m.user_id = OLD.user_id
    AND t.class_id = OLD.class_id
    AND t.kind IN ('subject_group', 'class_group');

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS class_memberships_after_delete ON public.class_memberships;
CREATE TRIGGER class_memberships_after_delete
  AFTER DELETE ON public.class_memberships
  FOR EACH ROW EXECUTE FUNCTION public.class_memberships_after_delete();

-- Bump thread updated_at on new message
CREATE OR REPLACE FUNCTION public.chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.chat_threads SET updated_at = now() WHERE id = NEW.thread_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_after_insert ON public.chat_messages;
CREATE TRIGGER chat_messages_after_insert
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_after_insert();

-- RPC: join a class (student self-enroll)
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
  IF NOT EXISTS (SELECT 1 FROM public.classes c WHERE c.id = p_class_id AND c.active) THEN
    RAISE EXCEPTION 'Class not found';
  END IF;

  DELETE FROM public.class_memberships WHERE user_id = auth.uid();

  INSERT INTO public.class_memberships (class_id, user_id)
  VALUES (p_class_id, auth.uid())
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_class(uuid) TO authenticated;

-- RPC: open or create a direct thread with another user
CREATE OR REPLACE FUNCTION public.open_direct_thread(p_other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tid uuid;
  my_id uuid := auth.uid();
BEGIN
  IF my_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_other_user_id = my_id THEN RAISE EXCEPTION 'Cannot message yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_other_user_id) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  SELECT t.id INTO tid
  FROM public.chat_threads t
  WHERE t.kind = 'direct'
    AND EXISTS (SELECT 1 FROM public.chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = my_id)
    AND EXISTS (SELECT 1 FROM public.chat_thread_members m WHERE m.thread_id = t.id AND m.user_id = p_other_user_id)
  LIMIT 1;

  IF tid IS NOT NULL THEN RETURN tid; END IF;

  INSERT INTO public.chat_threads (kind, title, created_by)
  VALUES ('direct', 'Direct message', my_id)
  RETURNING id INTO tid;

  INSERT INTO public.chat_thread_members (thread_id, user_id) VALUES
    (tid, my_id),
    (tid, p_other_user_id);

  RETURN tid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.open_direct_thread(uuid) TO authenticated;

-- ---------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------
GRANT SELECT ON public.classes TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.classes TO authenticated;

GRANT SELECT, INSERT, DELETE ON public.class_memberships TO authenticated;

GRANT SELECT ON public.chat_threads TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_thread_members TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.chat_messages TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.chat_message_attachments TO authenticated;

GRANT SELECT ON public.homework_assignments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.homework_assignments TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.homework_files TO authenticated;

GRANT SELECT, INSERT, UPDATE ON public.homework_submissions TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.homework_submission_files TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.lesson_attendance TO authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_thread_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submission_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lesson_attendance ENABLE ROW LEVEL SECURITY;

-- classes
DROP POLICY IF EXISTS "classes read active" ON public.classes;
CREATE POLICY "classes read active" ON public.classes
  FOR SELECT TO authenticated
  USING (active OR public.bs_is_staff());

DROP POLICY IF EXISTS "classes staff write" ON public.classes;
CREATE POLICY "classes staff write" ON public.classes
  FOR ALL TO authenticated
  USING (public.bs_is_staff()) WITH CHECK (public.bs_is_staff());

-- memberships
DROP POLICY IF EXISTS "memberships read own or staff" ON public.class_memberships;
CREATE POLICY "memberships read own or staff" ON public.class_memberships
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "memberships insert own or staff" ON public.class_memberships;
CREATE POLICY "memberships insert own or staff" ON public.class_memberships
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "memberships delete own or staff" ON public.class_memberships;
CREATE POLICY "memberships delete own or staff" ON public.class_memberships
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

-- profiles: allow classmates / staff to read chat fields via username search
DROP POLICY IF EXISTS "Users view own profile" ON public.profiles;
CREATE POLICY "Users view own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "Staff view all profiles" ON public.profiles;
CREATE POLICY "Staff view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (public.bs_is_staff());

DROP POLICY IF EXISTS "Authenticated read class profiles" ON public.profiles;
CREATE POLICY "Authenticated read class profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR public.bs_is_staff()
    OR (
      username IS NOT NULL
      AND chat_setup_completed = true
    )
  );

-- threads
DROP POLICY IF EXISTS "threads read members" ON public.chat_threads;
CREATE POLICY "threads read members" ON public.chat_threads
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR public.bs_is_thread_member(id)
    OR (kind IN ('subject_group', 'class_group') AND class_id IS NOT NULL AND public.bs_is_class_member(class_id))
  );

DROP POLICY IF EXISTS "threads staff manage" ON public.chat_threads;
CREATE POLICY "threads staff manage" ON public.chat_threads
  FOR ALL TO authenticated
  USING (public.bs_is_staff()) WITH CHECK (public.bs_is_staff());

DROP POLICY IF EXISTS "threads insert direct" ON public.chat_threads;
CREATE POLICY "threads insert direct" ON public.chat_threads
  FOR INSERT TO authenticated
  WITH CHECK (kind = 'direct' AND created_by = auth.uid());

-- thread members
DROP POLICY IF EXISTS "thread members read" ON public.chat_thread_members;
CREATE POLICY "thread members read" ON public.chat_thread_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff() OR public.bs_is_thread_member(thread_id));

DROP POLICY IF EXISTS "thread members insert self" ON public.chat_thread_members;
CREATE POLICY "thread members insert self" ON public.chat_thread_members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "thread members update self" ON public.chat_thread_members;
CREATE POLICY "thread members update self" ON public.chat_thread_members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff())
  WITH CHECK (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "thread members delete staff" ON public.chat_thread_members;
CREATE POLICY "thread members delete staff" ON public.chat_thread_members
  FOR DELETE TO authenticated
  USING (public.bs_is_staff() OR user_id = auth.uid());

-- messages
DROP POLICY IF EXISTS "messages read members" ON public.chat_messages;
CREATE POLICY "messages read members" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (public.bs_is_thread_member(thread_id));

DROP POLICY IF EXISTS "messages insert members" ON public.chat_messages;
CREATE POLICY "messages insert members" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid() AND public.bs_is_thread_member(thread_id));

DROP POLICY IF EXISTS "messages update own or staff" ON public.chat_messages;
CREATE POLICY "messages update own or staff" ON public.chat_messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid() OR public.bs_is_staff())
  WITH CHECK (sender_id = auth.uid() OR public.bs_is_staff());

-- attachments
DROP POLICY IF EXISTS "msg attachments read" ON public.chat_message_attachments;
CREATE POLICY "msg attachments read" ON public.chat_message_attachments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND public.bs_is_thread_member(m.thread_id)
    )
  );

DROP POLICY IF EXISTS "msg attachments insert" ON public.chat_message_attachments;
CREATE POLICY "msg attachments insert" ON public.chat_message_attachments
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "msg attachments delete" ON public.chat_message_attachments;
CREATE POLICY "msg attachments delete" ON public.chat_message_attachments
  FOR DELETE TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.chat_messages m
      WHERE m.id = message_id AND m.sender_id = auth.uid()
    )
  );

-- homework assignments
DROP POLICY IF EXISTS "hw read class or staff" ON public.homework_assignments;
CREATE POLICY "hw read class or staff" ON public.homework_assignments
  FOR SELECT TO authenticated
  USING (public.bs_is_class_member(class_id) OR public.bs_is_staff());

DROP POLICY IF EXISTS "hw staff write" ON public.homework_assignments;
CREATE POLICY "hw staff write" ON public.homework_assignments
  FOR ALL TO authenticated
  USING (public.bs_is_staff()) WITH CHECK (public.bs_is_staff());

DROP POLICY IF EXISTS "hw files read" ON public.homework_files;
CREATE POLICY "hw files read" ON public.homework_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework_assignments a
      WHERE a.id = assignment_id
        AND (public.bs_is_class_member(a.class_id) OR public.bs_is_staff())
    )
  );

DROP POLICY IF EXISTS "hw files staff write" ON public.homework_files;
CREATE POLICY "hw files staff write" ON public.homework_files
  FOR ALL TO authenticated
  USING (public.bs_is_staff()) WITH CHECK (public.bs_is_staff());

-- submissions
DROP POLICY IF EXISTS "hw sub read own or staff" ON public.homework_submissions;
CREATE POLICY "hw sub read own or staff" ON public.homework_submissions
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "hw sub insert own" ON public.homework_submissions;
CREATE POLICY "hw sub insert own" ON public.homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "hw sub update own or staff" ON public.homework_submissions;
CREATE POLICY "hw sub update own or staff" ON public.homework_submissions
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid() OR public.bs_is_staff())
  WITH CHECK (student_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "hw sub files read" ON public.homework_submission_files;
CREATE POLICY "hw sub files read" ON public.homework_submission_files
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.homework_submissions s
      WHERE s.id = submission_id
        AND (s.student_id = auth.uid() OR public.bs_is_staff())
    )
  );

DROP POLICY IF EXISTS "hw sub files insert own" ON public.homework_submission_files;
CREATE POLICY "hw sub files insert own" ON public.homework_submission_files
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.homework_submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
    OR public.bs_is_staff()
  );

DROP POLICY IF EXISTS "hw sub files delete" ON public.homework_submission_files;
CREATE POLICY "hw sub files delete" ON public.homework_submission_files
  FOR DELETE TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.homework_submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
  );

-- attendance
DROP POLICY IF EXISTS "attendance read own or staff" ON public.lesson_attendance;
CREATE POLICY "attendance read own or staff" ON public.lesson_attendance
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

DROP POLICY IF EXISTS "attendance staff write" ON public.lesson_attendance;
CREATE POLICY "attendance staff write" ON public.lesson_attendance
  FOR ALL TO authenticated
  USING (public.bs_is_staff()) WITH CHECK (public.bs_is_staff());

-- ---------------------------------------------------------------------
-- Storage buckets + policies
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-uploads', 'chat-uploads', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('homework-uploads', 'homework-uploads', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat uploads read auth" ON storage.objects;
CREATE POLICY "chat uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads');

DROP POLICY IF EXISTS "chat uploads write auth" ON storage.objects;
CREATE POLICY "chat uploads write auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "chat uploads update own" ON storage.objects;
CREATE POLICY "chat uploads update own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff()))
  WITH CHECK (bucket_id = 'chat-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff()));

DROP POLICY IF EXISTS "chat uploads delete own" ON storage.objects;
CREATE POLICY "chat uploads delete own" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'chat-uploads' AND (auth.uid()::text = (storage.foldername(name))[1] OR public.bs_is_staff()));

DROP POLICY IF EXISTS "hw uploads read auth" ON storage.objects;
CREATE POLICY "hw uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'homework-uploads');

DROP POLICY IF EXISTS "hw uploads write auth" ON storage.objects;
CREATE POLICY "hw uploads write auth" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'homework-uploads'
    AND (
      public.bs_is_staff()
      OR auth.uid()::text = (storage.foldername(name))[1]
    )
  );

DROP POLICY IF EXISTS "hw uploads update" ON storage.objects;
CREATE POLICY "hw uploads update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'homework-uploads'
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'homework-uploads'
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  );

DROP POLICY IF EXISTS "hw uploads delete" ON storage.objects;
CREATE POLICY "hw uploads delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'homework-uploads'
    AND (public.bs_is_staff() OR auth.uid()::text = (storage.foldername(name))[1])
  );

-- Seed threads for any existing classes
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.classes LOOP
    PERFORM public.ensure_class_threads(r.id);
  END LOOP;
END $$;
