-- Publish an SQB pack and the questions still linked to it in one transaction.
-- The publish guard rejects a published SQB test that still has an unpublished
-- SQB question, so two separate updates leave the pack as a draft.

CREATE OR REPLACE FUNCTION public.staff_publish_sqb_test(p_test_id uuid, p_publish boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT id INTO v_id
  FROM public.tests
  WHERE id = p_test_id AND bank_format = 'sqb';
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'SQB test not found';
  END IF;

  UPDATE public.questions q
  SET published = p_publish
  WHERE q.bank_format = 'sqb'
    AND q.id IN (
      SELECT tq.question_id FROM public.test_questions tq WHERE tq.test_id = p_test_id
    );

  IF p_publish THEN
    UPDATE public.tests
    SET published = true, in_test_base = false
    WHERE id = p_test_id;
  ELSE
    UPDATE public.tests
    SET published = false
    WHERE id = p_test_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_publish_sqb_test(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_publish_sqb_test(uuid, boolean) TO authenticated;
