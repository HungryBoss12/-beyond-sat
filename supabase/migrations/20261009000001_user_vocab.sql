-- Students can keep private vocab decks and practice tests, then send them
-- for review. Existing admin rows stay published with no owner.

ALTER TABLE public.vocab_decks
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.vocab_quizzes
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS submitted_at timestamptz;

ALTER TABLE public.vocab_decks DROP CONSTRAINT IF EXISTS vocab_decks_visibility_check;
ALTER TABLE public.vocab_decks
  ADD CONSTRAINT vocab_decks_visibility_check
  CHECK (visibility IN ('private', 'pending', 'published'));

ALTER TABLE public.vocab_quizzes DROP CONSTRAINT IF EXISTS vocab_quizzes_visibility_check;
ALTER TABLE public.vocab_quizzes
  ADD CONSTRAINT vocab_quizzes_visibility_check
  CHECK (visibility IN ('private', 'pending', 'published'));

UPDATE public.vocab_decks SET visibility = 'published' WHERE owner_id IS NULL;
UPDATE public.vocab_quizzes SET visibility = 'published' WHERE owner_id IS NULL;

CREATE INDEX IF NOT EXISTS vocab_decks_owner_idx ON public.vocab_decks (owner_id, visibility);
CREATE INDEX IF NOT EXISTS vocab_quizzes_owner_day_idx ON public.vocab_quizzes (owner_id, created_at);
CREATE INDEX IF NOT EXISTS vocab_decks_pending_idx ON public.vocab_decks (submitted_at) WHERE visibility = 'pending';
CREATE INDEX IF NOT EXISTS vocab_quizzes_pending_idx ON public.vocab_quizzes (submitted_at) WHERE visibility = 'pending';

INSERT INTO public.app_settings (key, value)
VALUES ('vocab_user_test_daily_cap', '5')
ON CONFLICT (key) DO NOTHING;

-- A signed-in student who sets an owner can only keep a private or pending row.
-- Staff and the service-role admin importer (no owner) stay published.
CREATE OR REPLACE FUNCTION public.bs_guard_user_vocab_deck()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.bs_is_staff() OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your deck';
  END IF;
  IF NEW.visibility IS NULL OR NEW.visibility NOT IN ('private', 'pending') THEN
    NEW.visibility := 'private';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vocab_decks_guard_owner ON public.vocab_decks;
CREATE TRIGGER vocab_decks_guard_owner
  BEFORE INSERT OR UPDATE ON public.vocab_decks
  FOR EACH ROW EXECUTE FUNCTION public.bs_guard_user_vocab_deck();

CREATE OR REPLACE FUNCTION public.bs_guard_user_vocab_quiz()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer := 5;
  v_raw text;
  v_used integer;
  v_day timestamptz;
BEGIN
  IF public.bs_is_staff() OR NEW.owner_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not your quiz';
  END IF;
  IF NEW.visibility IS NULL OR NEW.visibility NOT IN ('private', 'pending') THEN
    NEW.visibility := 'private';
  END IF;
  IF TG_OP = 'INSERT' THEN
    SELECT value INTO v_raw FROM public.app_settings WHERE key = 'vocab_user_test_daily_cap';
    IF v_raw ~ '^[0-9]+$' THEN
      v_cap := v_raw::integer;
    END IF;
    v_day := date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent';
    SELECT count(*)::integer INTO v_used
    FROM public.vocab_quizzes
    WHERE owner_id = NEW.owner_id
      AND created_at >= v_day;
    IF v_used >= v_cap THEN
      RAISE EXCEPTION 'daily test limit reached';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vocab_quizzes_guard_owner ON public.vocab_quizzes;
CREATE TRIGGER vocab_quizzes_guard_owner
  BEFORE INSERT OR UPDATE ON public.vocab_quizzes
  FOR EACH ROW EXECUTE FUNCTION public.bs_guard_user_vocab_quiz();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocab_decks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocab_cards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vocab_quizzes TO authenticated;

DROP POLICY IF EXISTS "vocab_decks read" ON public.vocab_decks;
CREATE POLICY "vocab_decks read visible" ON public.vocab_decks
  FOR SELECT TO authenticated
  USING (
    visibility = 'published'
    OR owner_id = auth.uid()
    OR public.bs_is_staff()
  );

DROP POLICY IF EXISTS "vocab_decks owner write" ON public.vocab_decks;
CREATE POLICY "vocab_decks owner write" ON public.vocab_decks
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND visibility IN ('private', 'pending'))
  WITH CHECK (owner_id = auth.uid() AND visibility IN ('private', 'pending'));

DROP POLICY IF EXISTS "vocab_cards read auth" ON public.vocab_cards;
CREATE POLICY "vocab_cards read visible" ON public.vocab_cards
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR deck_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.vocab_decks d
      WHERE d.id = vocab_cards.deck_id
        AND (d.visibility = 'published' OR d.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "vocab_cards owner write" ON public.vocab_cards;
CREATE POLICY "vocab_cards owner write" ON public.vocab_cards
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vocab_decks d
      WHERE d.id = vocab_cards.deck_id
        AND d.owner_id = auth.uid()
        AND d.visibility IN ('private', 'pending')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vocab_decks d
      WHERE d.id = vocab_cards.deck_id
        AND d.owner_id = auth.uid()
        AND d.visibility IN ('private', 'pending')
    )
  );

DROP POLICY IF EXISTS "vocab_quizzes read auth" ON public.vocab_quizzes;
CREATE POLICY "vocab_quizzes read visible" ON public.vocab_quizzes
  FOR SELECT TO authenticated
  USING (
    visibility = 'published'
    OR owner_id = auth.uid()
    OR public.bs_is_staff()
  );

DROP POLICY IF EXISTS "vocab_quizzes owner write" ON public.vocab_quizzes;
CREATE POLICY "vocab_quizzes owner write" ON public.vocab_quizzes
  FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND visibility IN ('private', 'pending'))
  WITH CHECK (owner_id = auth.uid() AND visibility IN ('private', 'pending'));

DROP POLICY IF EXISTS "vocab_quiz_questions read auth" ON public.vocab_quiz_questions;
CREATE POLICY "vocab_quiz_questions read visible" ON public.vocab_quiz_questions
  FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.vocab_quizzes q
      WHERE q.id = vocab_quiz_questions.quiz_id
        AND (q.visibility = 'published' OR q.owner_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "vocab_quiz_questions owner write" ON public.vocab_quiz_questions;
CREATE POLICY "vocab_quiz_questions owner write" ON public.vocab_quiz_questions
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vocab_quizzes q
      WHERE q.id = vocab_quiz_questions.quiz_id
        AND q.owner_id = auth.uid()
        AND q.visibility IN ('private', 'pending')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vocab_quizzes q
      WHERE q.id = vocab_quiz_questions.quiz_id
        AND q.owner_id = auth.uid()
        AND q.visibility IN ('private', 'pending')
    )
  );

CREATE OR REPLACE FUNCTION public.vocab_creator_names(p_ids uuid[])
RETURNS TABLE (id uuid, username text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.id, p.username
  FROM public.vocab_decks d
  JOIN public.profiles p ON p.id = d.owner_id
  WHERE d.id = ANY (p_ids)
    AND d.owner_id IS NOT NULL
    AND (
      d.visibility = 'published'
      OR d.owner_id = auth.uid()
      OR public.bs_is_staff()
    )
  UNION ALL
  SELECT q.id, p.username
  FROM public.vocab_quizzes q
  JOIN public.profiles p ON p.id = q.owner_id
  WHERE q.id = ANY (p_ids)
    AND q.owner_id IS NOT NULL
    AND (
      q.visibility = 'published'
      OR q.owner_id = auth.uid()
      OR public.bs_is_staff()
    );
$$;

REVOKE ALL ON FUNCTION public.vocab_creator_names(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vocab_creator_names(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.vocab_user_test_quota()
RETURNS TABLE (cap integer, used integer)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cap integer := 5;
  v_raw text;
  v_day timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'sign in required';
  END IF;
  SELECT value INTO v_raw FROM public.app_settings WHERE key = 'vocab_user_test_daily_cap';
  IF v_raw ~ '^[0-9]+$' THEN
    v_cap := v_raw::integer;
  END IF;
  v_day := date_trunc('day', now() AT TIME ZONE 'Asia/Tashkent') AT TIME ZONE 'Asia/Tashkent';
  RETURN QUERY
  SELECT v_cap, count(*)::integer
  FROM public.vocab_quizzes
  WHERE owner_id = auth.uid()
    AND created_at >= v_day;
END;
$$;

REVOKE ALL ON FUNCTION public.vocab_user_test_quota() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.vocab_user_test_quota() TO authenticated;

CREATE OR REPLACE FUNCTION public.staff_decide_vocab_submission(
  p_kind text,
  p_id uuid,
  p_approve boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_title text;
  v_notif uuid;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'staff only';
  END IF;
  IF p_kind = 'deck' THEN
    UPDATE public.vocab_decks
    SET visibility = CASE WHEN p_approve THEN 'published' ELSE 'private' END,
        submitted_at = CASE WHEN p_approve THEN submitted_at ELSE NULL END
    WHERE id = p_id AND visibility = 'pending'
    RETURNING owner_id, title INTO v_owner, v_title;
  ELSIF p_kind = 'test' THEN
    UPDATE public.vocab_quizzes
    SET visibility = CASE WHEN p_approve THEN 'published' ELSE 'private' END,
        submitted_at = CASE WHEN p_approve THEN submitted_at ELSE NULL END
    WHERE id = p_id AND visibility = 'pending'
    RETURNING owner_id, title INTO v_owner, v_title;
  ELSE
    RAISE EXCEPTION 'unknown kind';
  END IF;
  IF v_title IS NULL THEN
    RAISE EXCEPTION 'submission not found';
  END IF;
  IF p_approve AND v_owner IS NOT NULL THEN
    INSERT INTO public.user_notifications (
      title, body, link_url, link_label, source_type, source_id, created_by,
      audience_type, expires_at, overlay_display_seconds
    ) VALUES (
      CASE WHEN p_kind = 'deck' THEN 'Your deck was accepted' ELSE 'Your test was accepted' END,
      v_title || ' is now in the main list.',
      CASE WHEN p_kind = 'deck' THEN '/vocab/decks' ELSE '/vocab/tests' END,
      'Open',
      'admin',
      p_id,
      auth.uid(),
      'users',
      now() + interval '365 days',
      30
    )
    RETURNING id INTO v_notif;
    INSERT INTO public.user_notification_recipients (notification_id, user_id)
    VALUES (v_notif, v_owner);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_decide_vocab_submission(text, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.staff_decide_vocab_submission(text, uuid, boolean) TO authenticated;
