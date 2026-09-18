-- Whitelist the AI-chat daily cap in the public settings RPC.
--
-- `get_ai_models()` is the one SECURITY DEFINER channel that exposes
-- app_settings rows to signed-in users (the table itself is admin-only).
-- The rate limiter reads `ai_chat_daily_cap` from it; allow-list it so admins
-- can tune the cap from /admin/settings without a redeploy. The WHERE clause
-- stays an allow-list, so no other settings row can leak.

CREATE OR REPLACE FUNCTION public.get_ai_models()
RETURNS TABLE (key text, value text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.key, s.value
  FROM public.app_settings s
  WHERE s.key IN (
    'openrouter_model_chat',
    'openrouter_model_quick',
    'openrouter_model_reasoning',
    'openrouter_model_vision',
    'ai_chat_daily_cap'
  );
$$;

REVOKE ALL ON FUNCTION public.get_ai_models() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_models() TO authenticated, service_role;
