-- New cards for a study session, and the deck list in one call. Both run with
-- the caller's rights so private decks stay hidden by the existing row rules.

CREATE OR REPLACE FUNCTION public.vocab_new_cards(p_deck_id uuid DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS SETOF public.vocab_cards
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT c.*
  FROM public.vocab_cards c
  WHERE (p_deck_id IS NULL OR c.deck_id IN (SELECT public.vocab_deck_descendant_ids(p_deck_id)))
    AND NOT EXISTS (
      SELECT 1 FROM public.user_card_states s
      WHERE s.card_id = c.id AND s.user_id = auth.uid()
    )
  ORDER BY c.created_at, c.id
  LIMIT greatest(0, least(coalesce(p_limit, 20), 100));
$$;

CREATE OR REPLACE FUNCTION public.vocab_deck_overview()
RETURNS TABLE (
  deck_id uuid,
  new_count integer,
  learning_count integer,
  review_count integer,
  total_count integer,
  last_studied timestamptz
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    c.deck_id,
    count(*) FILTER (WHERE s.card_id IS NULL OR s.state = 0)::integer,
    count(*) FILTER (WHERE s.state IN (1, 3))::integer,
    count(*) FILTER (WHERE s.state = 2 AND s.due <= now())::integer,
    count(*)::integer,
    max(s.last_review)
  FROM public.vocab_cards c
  LEFT JOIN public.user_card_states s
    ON s.card_id = c.id AND s.user_id = auth.uid()
  WHERE c.deck_id IS NOT NULL
  GROUP BY c.deck_id;
$$;

REVOKE ALL ON FUNCTION public.vocab_new_cards(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.vocab_deck_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vocab_new_cards(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.vocab_deck_overview() TO authenticated, service_role;
