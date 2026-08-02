-- ---------------------------------------------------------------------
-- SEED_EXAM_DATES.sql  —  run this if you already ran FRESH_PROJECT_SCHEMA.sql
-- ---------------------------------------------------------------------
-- Only needed on a project whose schema was created before the seed rows were
-- added to FRESH_PROJECT_SCHEMA.sql. Running it twice is harmless.
--
-- Why it exists: onboarding asks every new user to pick an exam date, and RLS
-- only lets an admin create them. With an empty `exam_dates` table nobody can
-- finish onboarding — and since every signed-in route redirects to /onboarding
-- until it is done, the first admin can't reach Admin -> Exam Dates either.
--
-- Paste into the Supabase SQL editor (SQL Editor -> New query -> Run).
--
-- These are the usual Saturday slots, NOT scraped from collegeboard.org.
-- After signing in as admin, open Admin -> Exam Dates and correct anything
-- that has moved. You can add, hide or delete dates from there.

insert into public.exam_dates (exam_date, label, active) values
  ('2026-08-29', 'August 2026',    true),
  ('2026-09-12', 'September 2026', true),
  ('2026-10-03', 'October 2026',   true),
  ('2026-11-07', 'November 2026',  true),
  ('2026-12-05', 'December 2026',  true),
  ('2027-03-13', 'March 2027',     true),
  ('2027-05-01', 'May 2027',       true),
  ('2027-06-05', 'June 2027',      true)
on conflict (exam_date) do nothing;

-- Verify — should list every future date as active.
select exam_date, label, active
  from public.exam_dates
 order by exam_date;
