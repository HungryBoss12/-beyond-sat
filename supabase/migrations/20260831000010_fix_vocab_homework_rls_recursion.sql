-- Fix infinite RLS recursion between vocab_homework_assignments
-- and vocab_homework_assignment_users (each policy queried the other).

DROP POLICY IF EXISTS "vocab_homework_assignment_users read" ON public.vocab_homework_assignment_users;

CREATE POLICY "vocab_homework_assignment_users read"
  ON public.vocab_homework_assignment_users FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR user_id = auth.uid()
  );

-- SECURITY DEFINER helper avoids re-entering assignments RLS from junction lookups.
CREATE OR REPLACE FUNCTION public.bs_is_vocab_homework_assigned(
  p_assignment_id uuid,
  p_user_id uuid DEFAULT auth.uid()
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.vocab_homework_assignment_users ahu
    WHERE ahu.assignment_id = p_assignment_id
      AND ahu.user_id = p_user_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.bs_is_vocab_homework_assigned(uuid, uuid) TO authenticated;

DROP POLICY IF EXISTS "vocab_homework_assignments read" ON public.vocab_homework_assignments;

CREATE POLICY "vocab_homework_assignments read"
  ON public.vocab_homework_assignments FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR (
      active
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at >= now())
      AND (
        audience_type = 'all'
        OR (audience_type = 'class' AND public.bs_is_class_member(class_id))
        OR (
          audience_type = 'users'
          AND public.bs_is_vocab_homework_assigned(id)
        )
      )
    )
  );
