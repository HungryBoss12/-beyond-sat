-- Remove ambiguous single-arg overload; keep vocab_due_count(uuid, uuid).
DROP FUNCTION IF EXISTS public.vocab_due_count(uuid);
