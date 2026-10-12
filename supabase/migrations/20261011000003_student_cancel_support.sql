-- A student may cancel their own pending support request. That frees the slot,
-- because only pending and confirmed rows hold it.

CREATE OR REPLACE FUNCTION public.student_cancel_support(p_session_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student uuid := auth.uid();
  v_status text;
  v_owner uuid;
BEGIN
  IF v_student IS NULL THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  SELECT student_id, status INTO v_owner, v_status
  FROM public.support_sessions
  WHERE id = p_session_id;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'Session not found';
  END IF;
  IF v_owner <> v_student THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Only a pending request can be cancelled';
  END IF;
  UPDATE public.support_sessions
  SET status = 'rejected',
      rejection_reason = 'Cancelled by student'
  WHERE id = p_session_id;
END;
$$;

REVOKE ALL ON FUNCTION public.student_cancel_support(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_cancel_support(uuid) TO authenticated, service_role;
