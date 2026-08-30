-- Deck tree + Anki-style card fields + per-deck stats RPC.

ALTER TABLE public.vocab_decks
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.vocab_decks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_folder boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS path text;

CREATE UNIQUE INDEX IF NOT EXISTS vocab_decks_path_unique ON public.vocab_decks (path) WHERE path IS NOT NULL;

CREATE INDEX IF NOT EXISTS vocab_decks_parent_idx ON public.vocab_decks (parent_id);
CREATE INDEX IF NOT EXISTS vocab_decks_sort_idx ON public.vocab_decks (sort_order, title);

ALTER TABLE public.vocab_cards
  ADD COLUMN IF NOT EXISTS example_sentence text,
  ADD COLUMN IF NOT EXISTS antonym text,
  ADD COLUMN IF NOT EXISTS set_label text;

-- Anki-style counts for a deck (leaf) or aggregated folder.
CREATE OR REPLACE FUNCTION public.vocab_deck_stats(
  p_user_id uuid DEFAULT auth.uid(),
  p_deck_id uuid DEFAULT NULL
)
RETURNS TABLE (
  new_count integer,
  learning_count integer,
  review_count integer,
  total_count integer
)
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
  ),
  deck_ids AS (
    SELECT id FROM deck_tree WHERE p_deck_id IS NOT NULL
    UNION ALL
    SELECT id FROM public.vocab_decks WHERE p_deck_id IS NULL
  ),
  cards_in_scope AS (
    SELECT c.id AS card_id
    FROM public.vocab_cards c
    WHERE (
      p_deck_id IS NULL
      OR c.deck_id IN (SELECT id FROM deck_ids)
    )
  ),
  states AS (
    SELECT ucs.card_id, ucs.state, ucs.due
    FROM public.user_card_states ucs
    WHERE ucs.user_id = p_user_id
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
$$;

GRANT EXECUTE ON FUNCTION public.vocab_deck_stats(uuid, uuid) TO authenticated;
