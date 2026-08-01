-- =====================================================================
-- STEP 1 of 2 — run this on its own, then run step 2.
--
-- Postgres refuses to *use* a new enum label inside the same transaction
-- that adds it, and the Supabase SQL editor runs each execution as one
-- transaction. Step 2 creates functions and policies that reference
-- 'editor', so it has to be a separate run.
-- =====================================================================

alter type public.app_role add value if not exists 'editor';
