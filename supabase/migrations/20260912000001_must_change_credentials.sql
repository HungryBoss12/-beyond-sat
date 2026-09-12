-- Admin-created accounts must change password (and may set email/username)
-- on first login before SAT onboarding.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_credentials boolean NOT NULL DEFAULT false;
