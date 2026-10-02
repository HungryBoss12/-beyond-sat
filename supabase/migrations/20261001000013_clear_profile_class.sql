-- The membership wipe cleared class_memberships, but the profile security lock
-- keeps class_id unless the session is staff. Drop the stale pointer so a
-- student with no membership is not still shown as in a class.

ALTER TABLE public.profiles DISABLE TRIGGER bs_profiles_lock_security_columns;

UPDATE public.profiles p
SET class_id = NULL
WHERE p.class_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.class_memberships m WHERE m.user_id = p.id
  );

ALTER TABLE public.profiles ENABLE TRIGGER bs_profiles_lock_security_columns;
