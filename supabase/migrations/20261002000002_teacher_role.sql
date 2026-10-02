-- Postgres refuses to use a new app_role value in the same transaction that
-- adds it. Policies and functions that mention 'teacher' are in the next file.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'teacher';
