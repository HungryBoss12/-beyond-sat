-- Anki-style vocab decks: group cards for per-deck SRS sessions.

CREATE TABLE IF NOT EXISTS public.vocab_decks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.vocab_decks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vocab_decks read" ON public.vocab_decks
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "vocab_decks staff write" ON public.vocab_decks
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

GRANT SELECT ON public.vocab_decks TO authenticated;
GRANT ALL ON public.vocab_decks TO service_role;

ALTER TABLE public.vocab_cards
  ADD COLUMN IF NOT EXISTS deck_id uuid REFERENCES public.vocab_decks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vocab_cards_deck_idx ON public.vocab_cards (deck_id);

-- Default deck for existing cards
INSERT INTO public.vocab_decks (id, title, description)
VALUES (
  '00000000-0000-4000-8000-000000000001',
  'SAT Vocab',
  'Default Beyond SAT vocabulary deck'
)
ON CONFLICT (id) DO NOTHING;

UPDATE public.vocab_cards
SET deck_id = '00000000-0000-4000-8000-000000000001'
WHERE deck_id IS NULL;

-- Per-deck due count (null deck = all decks)
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
    AND (p_deck_id IS NULL OR c.deck_id = p_deck_id);
$$;

GRANT EXECUTE ON FUNCTION public.vocab_due_count(uuid, uuid) TO authenticated;
