-- Vocabulary module: SRS cards, quizzes, activity logs.

ALTER TABLE public.student_profiles
  ADD COLUMN IF NOT EXISTS last_active_at timestamptz;

CREATE TABLE IF NOT EXISTS public.vocab_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  word text NOT NULL UNIQUE,
  part_of_speech text NOT NULL,
  definition text NOT NULL,
  dsat_passage text NOT NULL,
  roots_etymology text,
  synonyms text[] NOT NULL DEFAULT '{}',
  sat_traps text,
  difficulty_tier text NOT NULL DEFAULT 'Medium'
    CHECK (difficulty_tier IN ('Foundational', 'Medium', 'Advanced')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_card_states (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.vocab_cards(id) ON DELETE CASCADE,
  due timestamptz NOT NULL DEFAULT now(),
  stability double precision NOT NULL DEFAULT 0,
  difficulty double precision NOT NULL DEFAULT 0,
  elapsed_days integer NOT NULL DEFAULT 0,
  scheduled_days integer NOT NULL DEFAULT 0,
  reps integer NOT NULL DEFAULT 0,
  lapses integer NOT NULL DEFAULT 0,
  state integer NOT NULL DEFAULT 0,
  last_review timestamptz,
  UNIQUE (user_id, card_id)
);

CREATE INDEX IF NOT EXISTS user_card_states_user_due_idx
  ON public.user_card_states (user_id, due);

CREATE TABLE IF NOT EXISTS public.vocab_quizzes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  time_limit_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vocab_quiz_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id uuid NOT NULL REFERENCES public.vocab_quizzes(id) ON DELETE CASCADE,
  vocab_card_id uuid REFERENCES public.vocab_cards(id) ON DELETE SET NULL,
  passage_text text NOT NULL,
  correct_answer text NOT NULL,
  options text[] NOT NULL,
  explanation text NOT NULL,
  position integer NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.vocab_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id uuid NOT NULL REFERENCES public.vocab_quizzes(id) ON DELETE CASCADE,
  score integer NOT NULL,
  total integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vocab_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date date NOT NULL,
  cards_reviewed integer NOT NULL DEFAULT 0,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, activity_date)
);

ALTER TABLE public.vocab_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_card_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_activity_logs ENABLE ROW LEVEL SECURITY;

-- Cards & quizzes: readable by all authenticated users; staff can write.
CREATE POLICY "vocab_cards read auth" ON public.vocab_cards
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vocab_cards staff write" ON public.vocab_cards
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "vocab_quizzes read auth" ON public.vocab_quizzes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vocab_quizzes staff write" ON public.vocab_quizzes
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "vocab_quiz_questions read auth" ON public.vocab_quiz_questions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "vocab_quiz_questions staff write" ON public.vocab_quiz_questions
  FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

-- Per-user SRS state & attempts.
CREATE POLICY "user_card_states own" ON public.user_card_states
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocab_quiz_attempts own" ON public.vocab_quiz_attempts
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "vocab_activity_logs own" ON public.vocab_activity_logs
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.vocab_due_count(p_user_id uuid DEFAULT auth.uid())
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(*)::integer
  FROM public.user_card_states
  WHERE user_id = p_user_id
    AND due <= now();
$$;

GRANT EXECUTE ON FUNCTION public.vocab_due_count(uuid) TO authenticated;
