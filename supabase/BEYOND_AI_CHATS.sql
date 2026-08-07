-- ===========================================================================
-- BEYOND_AI_CHATS.sql
--
-- Run this once in the Supabase SQL editor, after FRESH_PROJECT_SCHEMA.sql.
-- Safe to re-run: every statement is idempotent.
--
-- What it does: gives the new Beyond AI section (/beyond-ai) somewhere to keep
-- conversations. A left-hand chat list implies saved chats, and nothing in the
-- schema held them before. Two tables:
--
--   ai_conversations — one row per chat: title, chosen model, timestamps.
--   ai_messages     — the turns. user_id is denormalised onto every message on
--                     purpose: an RLS policy that joins back to the parent per
--                     row is slower AND easier to get wrong than a direct
--                     `auth.uid() = user_id` check, so each table enforces its
--                     own ownership policy independently.
--
-- Attachments ride in `ai_messages.image_url` as a data URL, not in a storage
-- bucket. The `question-images` bucket is admin-write only, and a student-
-- writable bucket means quota, cleanup and abuse handling for what is a
-- transient input. The data URL is sent inline to the model and stored here so
-- the turn still renders after a reload.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1) Conversations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New chat',
  -- The slug the chat page sends with every request; the server resolves it
  -- through CHAT_MODELS in src/lib/ai/router.ts. Stored per conversation so
  -- switching between chats restores each one's model.
  model_choice TEXT NOT NULL DEFAULT 'beyonder-2-0',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 2) Messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.ai_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL DEFAULT '',
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- 3) Ownership — same grant/RLS shape as test_sessions
--    (FRESH_PROJECT_SCHEMA.sql:304-312): users get full CRUD on their own rows,
--    nothing else. There is deliberately no admin exception here — chat is the
--    one table in the app that is purely personal, and nothing in the admin
--    surfaces reads it.
-- ---------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_conversations TO authenticated;
GRANT ALL ON public.ai_conversations TO service_role;
ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own conversations" ON public.ai_conversations
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own conversations" ON public.ai_conversations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own conversations" ON public.ai_conversations
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own conversations" ON public.ai_conversations
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_messages TO authenticated;
GRANT ALL ON public.ai_messages TO service_role;
ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own messages" ON public.ai_messages
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own messages" ON public.ai_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own messages" ON public.ai_messages
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users delete own messages" ON public.ai_messages
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 4) Housekeeping
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_ai_conversations_updated_at ON public.ai_conversations;
CREATE TRIGGER trg_ai_conversations_updated_at
  BEFORE UPDATE ON public.ai_conversations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- The sidebar lists chats newest-first; this is the index that query walks.
CREATE INDEX IF NOT EXISTS idx_ai_conversations_user
  ON public.ai_conversations (user_id, updated_at DESC);
-- Messages load per conversation, in order.
CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation
  ON public.ai_messages (conversation_id, created_at);
