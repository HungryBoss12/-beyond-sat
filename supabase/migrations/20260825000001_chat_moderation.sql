-- Chat moderation: mutes, message protect trigger, mute-aware insert.

CREATE TABLE IF NOT EXISTS public.chat_mutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.chat_threads(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  muted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reason text,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chat_mutes_scope_ok CHECK (
    (thread_id IS NOT NULL AND class_id IS NULL)
    OR (thread_id IS NULL AND class_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS chat_mutes_user_idx ON public.chat_mutes (user_id);
CREATE INDEX IF NOT EXISTS chat_mutes_thread_idx ON public.chat_mutes (thread_id) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS chat_mutes_class_idx ON public.chat_mutes (class_id) WHERE class_id IS NOT NULL;

-- One mute per user+thread and per user+class.
CREATE UNIQUE INDEX IF NOT EXISTS chat_mutes_user_thread_unique
  ON public.chat_mutes (user_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS chat_mutes_user_class_unique
  ON public.chat_mutes (user_id, class_id) WHERE class_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.bs_is_chat_muted(
  _thread_id uuid,
  _uid uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.chat_mutes m
    LEFT JOIN public.chat_threads t ON t.id = _thread_id
    WHERE m.user_id = _uid
      AND (m.muted_until IS NULL OR m.muted_until > now())
      AND (
        m.thread_id = _thread_id
        OR (m.class_id IS NOT NULL AND m.class_id = t.class_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.bs_is_chat_muted(uuid, uuid) TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_mutes TO authenticated;
ALTER TABLE public.chat_mutes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat mutes read staff or self" ON public.chat_mutes;
CREATE POLICY "chat mutes read staff or self" ON public.chat_mutes
  FOR SELECT TO authenticated
  USING (public.bs_is_staff() OR user_id = auth.uid());

DROP POLICY IF EXISTS "chat mutes staff write" ON public.chat_mutes;
CREATE POLICY "chat mutes staff write" ON public.chat_mutes
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

DROP POLICY IF EXISTS "messages insert members" ON public.chat_messages;
CREATE POLICY "messages insert members" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND public.bs_is_thread_member(thread_id)
    AND NOT public.bs_is_chat_muted(thread_id)
  );

CREATE OR REPLACE FUNCTION public.chat_messages_protect()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.bs_is_staff() THEN
    IF NEW.body IS DISTINCT FROM OLD.body AND NEW.deleted_at IS NULL THEN
      NEW.edited_at := now();
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.thread_id IS DISTINCT FROM OLD.thread_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Cannot reassign a chat message';
  END IF;

  IF NEW.sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Not allowed to edit this message';
  END IF;

  IF OLD.deleted_at IS NOT NULL AND NEW.deleted_at IS NULL THEN
    RAISE EXCEPTION 'Cannot undelete a message';
  END IF;

  IF NEW.body IS DISTINCT FROM OLD.body AND NEW.deleted_at IS NULL THEN
    NEW.edited_at := now();
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_messages_protect ON public.chat_messages;
CREATE TRIGGER chat_messages_protect
  BEFORE UPDATE ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_messages_protect();
