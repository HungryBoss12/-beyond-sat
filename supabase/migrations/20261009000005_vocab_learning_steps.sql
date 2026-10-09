-- ts-fsrs tracks the step inside the learning phase. Without it every learning
-- card read as step 0, so Good kept rescheduling it ten minutes out.

ALTER TABLE public.user_card_states
  ADD COLUMN IF NOT EXISTS learning_steps smallint NOT NULL DEFAULT 0;

-- Cards already reviewed in learning: their next Good moves them on.
UPDATE public.user_card_states
SET learning_steps = 1
WHERE state = 1 AND reps >= 1 AND learning_steps = 0;
