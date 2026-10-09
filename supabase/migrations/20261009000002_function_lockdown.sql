-- Visitors who are not signed in could call almost every public function.
-- Signed-in access stays as it is; visitors keep only the two state checks
-- the public pages read. Functions that only the server should call lose
-- the signed-in grant too.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig,
           has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_ok
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e'
      )
  LOOP
    EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO service_role', r.sig);
    IF r.auth_ok THEN
      EXECUTE format('GRANT EXECUTE ON ROUTINE %s TO authenticated', r.sig);
    END IF;
  END LOOP;
END $$;

REVOKE EXECUTE ON ALL ROUTINES IN SCHEMA public FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.get_registration_state() TO anon;
GRANT EXECUTE ON FUNCTION public.get_maintenance_state() TO anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon;

-- Server-only.
CREATE OR REPLACE FUNCTION public.bs_complete_first_login(p_user_id uuid, p_username text, p_email text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uname text;
  mail text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'missing user';
  END IF;

  uname := nullif(btrim(p_username), '');
  mail := nullif(btrim(p_email), '');

  IF uname IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE lower(username) = lower(uname)
      AND id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'username taken';
  END IF;

  PERFORM set_config('beyondsat.clear_must_change', 'on', true);

  UPDATE public.profiles
  SET
    username = COALESCE(uname, username),
    email = COALESCE(mail, email),
    must_change_credentials = false
  WHERE id = p_user_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_notification_recipients(
  p_audience_type notification_audience,
  p_class_id uuid DEFAULT NULL::uuid,
  p_user_ids uuid[] DEFAULT NULL::uuid[]
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT DISTINCT uid FROM (
    SELECT cm.user_id AS uid
    FROM public.class_memberships cm
    WHERE p_audience_type = 'class' AND cm.class_id = p_class_id
    UNION ALL
    SELECT p.id
    FROM public.profiles p
    WHERE p_audience_type = 'all'
    UNION ALL
    SELECT unnest(p_user_ids)
    WHERE p_audience_type = 'users' AND p_user_ids IS NOT NULL
  ) s
  WHERE uid IS NOT NULL
    AND (coalesce(auth.role(), '') = 'service_role' OR public.bs_is_staff());
$function$;

REVOKE EXECUTE ON FUNCTION public.bs_complete_first_login(uuid, text, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_notification_recipients(notification_audience, uuid, uuid[]) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_due_tuition_charges() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.my_tuition_snapshot() FROM authenticated;

-- Study counts: students see only their own numbers, and only decks they can read.
CREATE OR REPLACE FUNCTION public.vocab_deck_stats(p_user_id uuid DEFAULT auth.uid(), p_deck_id uuid DEFAULT NULL::uuid)
RETURNS TABLE(new_count integer, learning_count integer, review_count integer, total_count integer)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH RECURSIVE me AS (
    SELECT CASE
      WHEN public.bs_is_staff() THEN coalesce(p_user_id, auth.uid())
      ELSE auth.uid()
    END AS uid
  ),
  visible AS (
    SELECT d.id, d.parent_id
    FROM public.vocab_decks d
    WHERE d.visibility = 'published'
       OR d.owner_id = auth.uid()
       OR public.bs_is_staff()
  ),
  deck_tree AS (
    SELECT id FROM visible WHERE id = p_deck_id
    UNION ALL
    SELECT v.id FROM visible v
    JOIN deck_tree t ON v.parent_id = t.id
  ),
  deck_ids AS (
    SELECT id FROM deck_tree WHERE p_deck_id IS NOT NULL
    UNION ALL
    SELECT id FROM visible WHERE p_deck_id IS NULL
  ),
  cards_in_scope AS (
    SELECT c.id AS card_id
    FROM public.vocab_cards c
    WHERE c.deck_id IN (SELECT id FROM deck_ids)
       OR (p_deck_id IS NULL AND c.deck_id IS NULL)
  ),
  states AS (
    SELECT ucs.card_id, ucs.state, ucs.due
    FROM public.user_card_states ucs
    WHERE ucs.user_id = (SELECT uid FROM me)
      AND ucs.card_id IN (SELECT card_id FROM cards_in_scope)
  )
  SELECT
    count(*) FILTER (
      WHERE s.card_id IS NULL OR s.state = 0
    )::integer AS new_count,
    count(*) FILTER (
      WHERE s.state IN (1, 3)
    )::integer AS learning_count,
    count(*) FILTER (
      WHERE s.state = 2 AND s.due <= now()
    )::integer AS review_count,
    (SELECT count(*)::integer FROM cards_in_scope) AS total_count
  FROM cards_in_scope c
  LEFT JOIN states s ON s.card_id = c.card_id;
$function$;

CREATE OR REPLACE FUNCTION public.vocab_due_count(p_user_id uuid DEFAULT auth.uid(), p_deck_id uuid DEFAULT NULL::uuid)
RETURNS integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT count(*)::integer
  FROM public.user_card_states ucs
  JOIN public.vocab_cards c ON c.id = ucs.card_id
  LEFT JOIN public.vocab_decks d ON d.id = c.deck_id
  WHERE ucs.user_id = CASE
      WHEN public.bs_is_staff() THEN coalesce(p_user_id, auth.uid())
      ELSE auth.uid()
    END
    AND ucs.due <= now()
    AND (
      c.deck_id IS NULL
      OR d.visibility = 'published'
      OR d.owner_id = auth.uid()
      OR public.bs_is_staff()
    )
    AND (
      p_deck_id IS NULL
      OR c.deck_id IN (SELECT public.vocab_deck_descendant_ids(p_deck_id))
    );
$function$;

-- The REST API never uses these, and nobody outside the server needs them.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLES FROM anon, authenticated;
