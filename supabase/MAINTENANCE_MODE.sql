-- ===========================================================================
-- Beyond AI + Maintenance Mode
--
-- Paste this whole file into the Supabase SQL editor and run it once. It is
-- idempotent — re-running it is safe.
--
-- Adds:
--   1. Settings keys for the three OpenRouter model IDs + the maintenance flag
--   2. public.get_maintenance_state()  — public read of the flag (anon + auth)
--   3. public.get_ai_models()          — signed-in read of the three model IDs
--   4. public.is_admin()               — PostgREST-callable admin check
--
-- Why functions at all: `app_settings` restricts SELECT to admins
-- ("Admins can read settings"), so a visitor cannot read the maintenance flag
-- that gates them and a student cannot read the model IDs the chat needs.
-- These are SECURITY DEFINER functions exposing exactly those keys and nothing
-- else — the same pattern as the existing get_desmos_api_key().
--
-- The OpenRouter API key is deliberately NOT here. It is a Worker secret, set
-- from the project directory (npx, because wrangler is a devDependency here and
-- a bare `wrangler` resolves to a global path that does not exist):
--   npx wrangler secret put OPENROUTER_API_KEY
-- A key stored in this table would be readable by every admin session and would
-- travel to the browser on the settings page.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1. Seed the settings rows
--
-- Every default is a `:free` model — the platform is free to students, so a
-- paid model ID reaching production would be a billing surprise rather than a
-- feature. Admins can still point any of these at a paid model at
-- /admin/settings; nothing here forces the free tier, it only defaults to it.
-- --------------------------------------------------------------------------
INSERT INTO public.app_settings (key, value) VALUES
  ('maintenance_enabled',         'false'),
  ('maintenance_message',         ''),
  ('openrouter_model_chat',       'nvidia/nemotron-3-super-120b-a12b:free'),
  ('openrouter_model_quick',      'openrouter/free'),
  ('openrouter_model_reasoning',  'nvidia/nemotron-3-ultra-550b-a55b:free'),
  ('openrouter_model_vision',     'gemini-3-flash-preview')
ON CONFLICT (key) DO NOTHING;


-- --------------------------------------------------------------------------
-- 1b. Retire withdrawn OpenRouter model IDs
--
-- `ON CONFLICT DO NOTHING` above cannot fix an existing row, so this replaces
-- known-dead values. Matching on the old value leaves a deliberate admin choice
-- alone; re-running after the first pass is a no-op.
-- --------------------------------------------------------------------------
UPDATE public.app_settings SET value = 'nvidia/nemotron-3-super-120b-a12b:free'
WHERE key = 'openrouter_model_chat' AND value IN (
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'google/gemini-2.0-flash-001'
);

UPDATE public.app_settings SET value = 'openrouter/free'
WHERE key = 'openrouter_model_quick' AND value IN (
  'meta-llama/llama-3.2-3b-instruct:free',
  'nvidia/nemotron-3-nano-30b-a3b:free'
);

UPDATE public.app_settings SET value = 'nvidia/nemotron-3-ultra-550b-a55b:free'
WHERE key = 'openrouter_model_reasoning' AND value IN (
  'deepseek/deepseek-chat-v3.1:free',
  'deepseek/deepseek-r1:free'
);

UPDATE public.app_settings SET value = 'gemini-3-flash-preview'
WHERE key = 'openrouter_model_vision' AND value IN (
  'google/gemini-2.0-flash-001',
  'google/gemini-2.0-flash-exp:free'
);


-- --------------------------------------------------------------------------
-- 2. Public maintenance state
--
-- Granted to anon because the whole point is that a logged-out visitor's
-- request can be gated. Returns a row rather than a bare boolean so the message
-- comes back in the same round trip.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_maintenance_state()
RETURNS TABLE (enabled boolean, message text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(
      (SELECT value FROM public.app_settings WHERE key = 'maintenance_enabled'),
      'false'
    ) = 'true',
    COALESCE(
      (SELECT value FROM public.app_settings WHERE key = 'maintenance_message'),
      ''
    );
$$;

REVOKE ALL ON FUNCTION public.get_maintenance_state() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_maintenance_state() TO anon, authenticated, service_role;


-- --------------------------------------------------------------------------
-- 3. Model IDs for the AI proxy
--
-- Authenticated only — these are not secret, but there is no reason to hand the
-- platform's model configuration to anonymous traffic. The WHERE clause is an
-- allow-list: it can never return the Desmos key or any future secret row.
-- --------------------------------------------------------------------------
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
    'openrouter_model_vision'
  );
$$;

REVOKE ALL ON FUNCTION public.get_ai_models() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_models() TO authenticated, service_role;


-- --------------------------------------------------------------------------
-- 4. Admin check callable over PostgREST
--
-- private.has_role() is the real check, but PostgREST only exposes the `public`
-- schema, so the Worker cannot call it directly. This is a thin wrapper that
-- answers exactly one question about the *calling* user — it takes no argument,
-- so it cannot be used to probe anyone else's roles.
-- --------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(private.has_role(auth.uid(), 'admin'::app_role), false);
$$;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;
