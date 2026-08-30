-- Allow the same word in multiple decks (Anki parity).
-- Add descendant-deck helper for session queries.

ALTER TABLE public.vocab_cards DROP CONSTRAINT IF EXISTS vocab_cards_word_key;

CREATE UNIQUE INDEX IF NOT EXISTS vocab_cards_deck_word_unique
  ON public.vocab_cards (deck_id, word)
  WHERE deck_id IS NOT NULL;

-- Recursive deck subtree (same shape as vocab_deck_stats).
CREATE OR REPLACE FUNCTION public.vocab_deck_descendant_ids(p_deck_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH RECURSIVE deck_tree AS (
    SELECT id FROM public.vocab_decks WHERE id = p_deck_id
    UNION ALL
    SELECT d.id FROM public.vocab_decks d
    JOIN deck_tree t ON d.parent_id = t.id
  )
  SELECT id FROM deck_tree;
$$;

GRANT EXECUTE ON FUNCTION public.vocab_deck_descendant_ids(uuid) TO authenticated;

-- Per-deck due count using descendant deck scope (matches vocab_deck_stats).
CREATE OR REPLACE FUNCTION public.vocab_due_count(
  p_user_id uuid DEFAULT auth.uid(),
  p_deck_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.user_card_states ucs
  JOIN public.vocab_cards c ON c.id = ucs.card_id
  WHERE ucs.user_id = p_user_id
    AND ucs.due <= now()
    AND (
      p_deck_id IS NULL
      OR c.deck_id IN (SELECT public.vocab_deck_descendant_ids(p_deck_id))
    );
$$;

GRANT EXECUTE ON FUNCTION public.vocab_due_count(uuid, uuid) TO authenticated;
