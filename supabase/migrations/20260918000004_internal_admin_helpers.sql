-- Internal definer functions must resolve OTHER users' roles (the clamped
-- public.bs_is_admin can no longer do that). Swap their explicit-uid calls to
-- private.bs_is_admin_for, which is granted to service_role only. These
-- functions run as definer, so the grant follows the caller they actually
-- execute as (postgres via PostgREST service_role / worker admin calls).

CREATE OR REPLACE FUNCTION public.admin_list_telegram_admins()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  chat_id bigint,
  banned boolean,
  banned_reason text,
  is_self boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT
    p.id,
    p.email,
    p.full_name,
    p.telegram_admin_chat_id,
    COALESCE(p.banned, false),
    p.banned_reason,
    p.id = auth.uid()
  FROM public.profiles p
  WHERE p.telegram_admin_chat_id IS NOT NULL
    AND private.bs_is_admin_for(p.id)
    AND public.bs_is_admin()
  ORDER BY p.full_name NULLS LAST, p.email NULLS LAST;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_telegram_admin(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Only admins can revoke Telegram access';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Use Unlink to remove Telegram from your own account';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = p_user_id
      AND p.telegram_admin_chat_id IS NOT NULL
      AND private.bs_is_admin_for(p.id)
  ) THEN
    RAISE EXCEPTION 'Admin is not linked to Telegram';
  END IF;

  UPDATE public.profiles
  SET telegram_admin_chat_id = NULL
  WHERE id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_by_telegram_chat(p_chat_id bigint)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT p.id
  FROM public.profiles p
  WHERE p.telegram_admin_chat_id = p_chat_id
    AND private.bs_is_admin_for(p.id)
    AND NOT COALESCE(p.banned, false)
  LIMIT 1;
$$;

-- admin_users_summary/admin_user_detail call public.admin_user_role(p.id) for
-- per-row role labels; that function is admin-gated (self-check) and both
-- callers are admin-only definers, so the labels keep working unchanged. This
-- file only re-points the telegram trio — the only explicit-uid bs_is_admin
-- callers in the schema.
