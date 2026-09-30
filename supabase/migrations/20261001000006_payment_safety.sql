-- Hard limits on ledger amounts: configurable max per payment, CHECK backstop.

INSERT INTO public.app_settings (key, value)
VALUES ('billing_max_payment_uzs', '100000000')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.bs_max_payment_uzs()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw text;
  v_max bigint;
BEGIN
  SELECT value INTO v_raw FROM public.app_settings WHERE key = 'billing_max_payment_uzs';
  IF v_raw IS NULL OR v_raw !~ '^[0-9]{1,10}$' THEN
    RETURN 100000000;
  END IF;
  v_max := v_raw::bigint;
  RETURN LEAST(GREATEST(v_max, 1000), 1000000000);
END;
$$;

REVOKE ALL ON FUNCTION public.bs_max_payment_uzs() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_billing_limits()
RETURNS TABLE (min_payment_uzs bigint, max_payment_uzs bigint, confirm_over_uzs bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  min_payment_uzs := 1000;
  max_payment_uzs := public.bs_max_payment_uzs();
  confirm_over_uzs := 10000000;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_billing_limits() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_billing_limits() TO authenticated;

ALTER TABLE public.ledger_entries DROP CONSTRAINT IF EXISTS ledger_amount_sane;
ALTER TABLE public.ledger_entries
  ADD CONSTRAINT ledger_amount_sane CHECK (amount_uzs BETWEEN 1 AND 1000000000);

CREATE OR REPLACE FUNCTION public._billing_check_amount(p_amount_uzs bigint)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max bigint := public.bs_max_payment_uzs();
BEGIN
  IF p_amount_uzs IS NULL OR p_amount_uzs <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer';
  END IF;
  IF p_amount_uzs > v_max THEN
    RAISE EXCEPTION 'Amount is over the % UZS limit', to_char(v_max, 'FM999G999G999G999');
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_check_amount(bigint) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_record_payment(
  p_user_id uuid,
  p_amount_uzs bigint,
  p_method public.pay_method,
  p_occurred_on date,
  p_note text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  PERFORM public._billing_check_amount(p_amount_uzs);
  IF p_occurred_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, method, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'payment', p_amount_uzs, COALESCE(p_method, 'cash'),
    COALESCE(p_occurred_on, public.bs_tashkent_today()),
    left(COALESCE(NULLIF(btrim(p_note), ''), 'Payment'), 80), 'manual', p_idempotency_key, auth.uid()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_discount(
  p_user_id uuid,
  p_amount_uzs bigint,
  p_occurred_on date,
  p_note text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  PERFORM public._billing_check_amount(p_amount_uzs);
  IF p_occurred_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Date cannot be in the future';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'discount', p_amount_uzs, COALESCE(p_occurred_on, public.bs_tashkent_today()),
    left(COALESCE(NULLIF(btrim(p_note), ''), 'Discount'), 80), 'manual', p_idempotency_key, auth.uid()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_record_refund(
  p_user_id uuid,
  p_amount_uzs bigint,
  p_occurred_on date,
  p_note text,
  p_idempotency_key uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  PERFORM public._billing_check_amount(p_amount_uzs);
  IF p_occurred_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Date cannot be in the future';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'refund', p_amount_uzs, COALESCE(p_occurred_on, public.bs_tashkent_today()),
    left(COALESCE(NULLIF(btrim(p_note), ''), 'Refund'), 80), 'manual', p_idempotency_key, auth.uid()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;
