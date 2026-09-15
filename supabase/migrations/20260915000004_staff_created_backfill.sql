-- Backfill staff_created for accounts that already changed away from the synthetic email.
-- Prefer auth.users email / metadata; fall back to profiles synthetic emails.

UPDATE public.profiles p
SET staff_created = true
WHERE p.staff_created = false
  AND (
    p.email ILIKE '%@accounts.beyondsat.local'
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = p.id
        AND (
          u.email ILIKE '%@accounts.beyondsat.local'
          OR coalesce(u.raw_user_meta_data->>'staff_created', '') = 'true'
        )
    )
  );
