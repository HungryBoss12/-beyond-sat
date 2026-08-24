-- Harden Classes RLS after Bugbot review.
-- Fixes: open storage reads, self-join threads, inactive class join,
-- student self-approval of homework.

-- Membership: students may only self-join an active class (join_class RPC is definer).
DROP POLICY IF EXISTS "memberships insert own or staff" ON public.class_memberships;
CREATE POLICY "memberships insert own or staff" ON public.class_memberships
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.classes c
        WHERE c.id = class_id AND c.active
      )
    )
  );

-- Thread members: no joining arbitrary DMs / other-class groups.
DROP POLICY IF EXISTS "thread members insert self" ON public.chat_thread_members;
CREATE POLICY "thread members insert self" ON public.chat_thread_members
  FOR INSERT TO authenticated
  WITH CHECK (
    public.bs_is_staff()
    OR (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1
        FROM public.chat_threads t
        WHERE t.id = thread_id
          AND (
            (
              t.kind IN ('subject_group', 'class_group')
              AND t.class_id IS NOT NULL
              AND public.bs_is_class_member(t.class_id)
            )
            OR (t.kind = 'direct' AND t.created_by = auth.uid())
          )
      )
    )
  );

-- Homework submissions: students cannot insert an already-accepted row.
DROP POLICY IF EXISTS "hw sub insert own" ON public.homework_submissions;
CREATE POLICY "hw sub insert own" ON public.homework_submissions
  FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND status IN ('pending', 'submitted')
    AND reviewed_by IS NULL
    AND reviewed_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.homework_submissions_protect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.bs_is_staff() THEN
    RETURN NEW;
  END IF;
  IF NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assignment_id IS DISTINCT FROM OLD.assignment_id THEN
    RAISE EXCEPTION 'Cannot reassign a homework submission';
  END IF;
  NEW.reviewed_by := OLD.reviewed_by;
  NEW.reviewed_at := OLD.reviewed_at;
  NEW.review_note := OLD.review_note;
  IF OLD.status IN ('accepted', 'reviewed') THEN
    NEW.status := OLD.status;
  ELSE
    NEW.status := 'submitted';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS homework_submissions_protect ON public.homework_submissions;
CREATE TRIGGER homework_submissions_protect
  BEFORE UPDATE ON public.homework_submissions
  FOR EACH ROW EXECUTE FUNCTION public.homework_submissions_protect();

-- Storage helpers: path-scoped reads instead of whole-bucket SELECT.
CREATE OR REPLACE FUNCTION public.bs_can_read_chat_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_staff()
  OR split_part(_name, '/', 1) = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.chat_message_attachments a
    JOIN public.chat_messages m ON m.id = a.message_id
    WHERE a.storage_path = _name
      AND public.bs_is_thread_member(m.thread_id)
  )
  OR (
    split_part(_name, '/', 2) LIKE 'avatar-%'
    AND (
      EXISTS (
        SELECT 1
        FROM public.class_memberships viewer
        JOIN public.class_memberships owner ON owner.class_id = viewer.class_id
        WHERE viewer.user_id = auth.uid()
          AND owner.user_id::text = split_part(_name, '/', 1)
      )
      OR EXISTS (
        SELECT 1
        FROM public.chat_thread_members a
        JOIN public.chat_thread_members b ON a.thread_id = b.thread_id
        WHERE a.user_id = auth.uid()
          AND b.user_id::text = split_part(_name, '/', 1)
      )
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_can_read_homework_object(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_staff()
  OR split_part(_name, '/', 1) = auth.uid()::text
  OR EXISTS (
    SELECT 1
    FROM public.homework_files f
    JOIN public.homework_assignments a ON a.id = f.assignment_id
    WHERE f.storage_path = _name
      AND public.bs_is_class_member(a.class_id)
  )
  OR EXISTS (
    SELECT 1
    FROM public.homework_submission_files sf
    JOIN public.homework_submissions s ON s.id = sf.submission_id
    WHERE sf.storage_path = _name
      AND s.student_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.bs_can_read_chat_object(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.bs_can_read_homework_object(text) TO authenticated;

DROP POLICY IF EXISTS "chat uploads read auth" ON storage.objects;
CREATE POLICY "chat uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-uploads' AND public.bs_can_read_chat_object(name));

DROP POLICY IF EXISTS "hw uploads read auth" ON storage.objects;
CREATE POLICY "hw uploads read auth" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'homework-uploads' AND public.bs_can_read_homework_object(name));
