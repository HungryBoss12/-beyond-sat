-- Admin-only student fees and an append-only ledger. Balance is computed, never stored.

DO $$ BEGIN
  CREATE TYPE public.ledger_kind AS ENUM ('charge', 'payment', 'discount', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.pay_method AS ENUM ('cash', 'card', 'transfer');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.ledger_source AS ENUM ('auto', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.student_fees (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  monthly_fee_uzs bigint NOT NULL CHECK (monthly_fee_uzs > 0),
  effective_from date NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, effective_from)
);

CREATE TABLE IF NOT EXISTS public.ledger_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  kind public.ledger_kind NOT NULL,
  amount_uzs bigint NOT NULL CHECK (amount_uzs > 0),
  period date,
  method public.pay_method,
  occurred_on date NOT NULL,
  note text,
  source public.ledger_source NOT NULL DEFAULT 'manual',
  idempotency_key uuid UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  voided_at timestamptz,
  voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  void_reason text,
  CONSTRAINT ledger_period_month CHECK (period IS NULL OR period = date_trunc('month', period)::date),
  CONSTRAINT ledger_charge_has_period CHECK (kind <> 'charge' OR period IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS ledger_one_live_charge_per_month
  ON public.ledger_entries (user_id, period)
  WHERE kind = 'charge' AND voided_at IS NULL;

CREATE INDEX IF NOT EXISTS ledger_entries_user_idx
  ON public.ledger_entries (user_id, occurred_on DESC);

CREATE OR REPLACE FUNCTION public.ledger_entries_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Ledger rows cannot be deleted';
  END IF;
  IF NEW.amount_uzs IS DISTINCT FROM OLD.amount_uzs
     OR NEW.kind IS DISTINCT FROM OLD.kind
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.class_id IS DISTINCT FROM OLD.class_id
     OR NEW.period IS DISTINCT FROM OLD.period
     OR NEW.method IS DISTINCT FROM OLD.method
     OR NEW.occurred_on IS DISTINCT FROM OLD.occurred_on
     OR NEW.note IS DISTINCT FROM OLD.note
     OR NEW.source IS DISTINCT FROM OLD.source
     OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Ledger rows are append-only';
  END IF;
  IF OLD.voided_at IS NOT NULL THEN
    RAISE EXCEPTION 'Voided rows cannot be changed';
  END IF;
  IF NEW.voided_at IS NOT NULL AND COALESCE(btrim(NEW.void_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason required';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ledger_entries_guard ON public.ledger_entries;
CREATE TRIGGER ledger_entries_guard
  BEFORE UPDATE OR DELETE ON public.ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_guard();

ALTER TABLE public.student_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fees admin only" ON public.student_fees;
CREATE POLICY "fees admin only" ON public.student_fees
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

DROP POLICY IF EXISTS "ledger admin only" ON public.ledger_entries;
CREATE POLICY "ledger admin only" ON public.ledger_entries
  FOR SELECT TO authenticated
  USING (public.bs_is_admin());

GRANT SELECT ON public.student_fees TO authenticated;
GRANT SELECT ON public.ledger_entries TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.student_fees FROM authenticated, anon, PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_entries FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.student_fees TO service_role;
GRANT ALL ON public.ledger_entries TO service_role;

CREATE OR REPLACE FUNCTION public.bs_fee_for_month(p_user_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT f.monthly_fee_uzs
  FROM public.student_fees f
  WHERE f.user_id = p_user_id
    AND f.effective_from <= date_trunc('month', p_month)::date
  ORDER BY f.effective_from DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.bs_member_active_in_month(p_user_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM generate_series(
      date_trunc('month', p_month)::date,
      (date_trunc('month', p_month)::date + interval '1 month' - interval '1 day')::date,
      interval '1 day'
    ) AS d(day)
    WHERE (
      SELECT e.status
      FROM public.class_membership_events e
      WHERE e.user_id = p_user_id
        AND e.effective_on <= d.day::date
      ORDER BY e.effective_on DESC, e.created_at DESC
      LIMIT 1
    ) = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.bs_student_balance(p_user_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN kind IN ('payment', 'discount') THEN amount_uzs
      ELSE -amount_uzs
    END
  ), 0)::bigint
  FROM public.ledger_entries
  WHERE user_id = p_user_id AND voided_at IS NULL;
$$;

CREATE OR REPLACE FUNCTION public._billing_apply_recurring_fees(p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of date := COALESCE(p_as_of, public.bs_tashkent_today());
  v_user uuid;
  v_enrolled date;
  v_month date;
  v_end date;
  v_fee bigint;
  v_added int := 0;
  v_inserted int;
BEGIN
  v_end := date_trunc('month', v_as_of)::date;
  FOR v_user, v_enrolled IN
    SELECT m.user_id, MIN(m.enrolled_on)
    FROM public.class_memberships m
    GROUP BY m.user_id
  LOOP
    v_month := date_trunc('month', v_enrolled)::date;
    WHILE v_month <= v_end LOOP
      IF public.bs_member_active_in_month(v_user, v_month) THEN
        v_fee := public.bs_fee_for_month(v_user, v_month);
        IF v_fee IS NOT NULL THEN
          INSERT INTO public.ledger_entries (
            user_id, kind, amount_uzs, period, occurred_on, note, source, created_by
          )
          VALUES (
            v_user,
            'charge',
            v_fee,
            v_month,
            v_month,
            'Course fee · ' || to_char(v_month, 'FMMonth YYYY'),
            'auto',
            auth.uid()
          )
          ON CONFLICT (user_id, period) WHERE kind = 'charge' AND voided_at IS NULL
          DO NOTHING;
          GET DIAGNOSTICS v_inserted = ROW_COUNT;
          v_added := v_added + v_inserted;
        END IF;
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN v_added;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_apply_recurring_fees(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_monthly_fee(
  p_user_id uuid,
  p_fee_uzs bigint,
  p_effective_from date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF p_fee_uzs IS NULL OR p_fee_uzs <= 0 THEN
    RAISE EXCEPTION 'Monthly fee must be a positive integer';
  END IF;
  INSERT INTO public.student_fees (user_id, monthly_fee_uzs, effective_from, created_by)
  VALUES (p_user_id, p_fee_uzs, date_trunc('month', p_effective_from)::date, auth.uid())
  ON CONFLICT (user_id, effective_from) DO UPDATE SET
    monthly_fee_uzs = EXCLUDED.monthly_fee_uzs,
    created_by = EXCLUDED.created_by;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_apply_recurring_fees(p_as_of date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN public._billing_apply_recurring_fees(COALESCE(p_as_of, public.bs_tashkent_today()));
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_apply_recurring_fees_system(p_as_of date DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN public._billing_apply_recurring_fees(COALESCE(p_as_of, public.bs_tashkent_today()));
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_charge_month(p_user_id uuid, p_period date)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_period)::date;
  v_fee bigint;
  v_id uuid;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  v_fee := public.bs_fee_for_month(p_user_id, v_month);
  IF v_fee IS NULL THEN
    RAISE EXCEPTION 'No monthly fee is set for this student';
  END IF;
  BEGIN
    INSERT INTO public.ledger_entries (
      user_id, kind, amount_uzs, period, occurred_on, note, source, created_by
    )
    VALUES (
      p_user_id, 'charge', v_fee, v_month, public.bs_tashkent_today(),
      'Course fee · ' || to_char(v_month, 'FMMonth YYYY'), 'manual', auth.uid()
    )
    RETURNING id INTO v_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'already_charged';
  END;
  RETURN v_id;
END;
$$;

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
  IF p_amount_uzs IS NULL OR p_amount_uzs <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer';
  END IF;
  IF p_occurred_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Payment date cannot be in the future';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, method, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'payment', p_amount_uzs, p_method, p_occurred_on,
    COALESCE(NULLIF(btrim(p_note), ''), 'Payment'), 'manual', p_idempotency_key, auth.uid()
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
  IF p_amount_uzs IS NULL OR p_amount_uzs <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'discount', p_amount_uzs, COALESCE(p_occurred_on, public.bs_tashkent_today()),
    COALESCE(NULLIF(btrim(p_note), ''), 'Discount'), 'manual', p_idempotency_key, auth.uid()
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
  IF p_amount_uzs IS NULL OR p_amount_uzs <= 0 THEN
    RAISE EXCEPTION 'Amount must be a positive integer';
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, kind, amount_uzs, occurred_on, note, source, idempotency_key, created_by
  )
  VALUES (
    p_user_id, 'refund', p_amount_uzs, COALESCE(p_occurred_on, public.bs_tashkent_today()),
    COALESCE(NULLIF(btrim(p_note), ''), 'Refund'), 'manual', p_idempotency_key, auth.uid()
  )
  ON CONFLICT (idempotency_key) DO NOTHING
  RETURNING id INTO v_id;
  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM public.ledger_entries WHERE idempotency_key = p_idempotency_key;
  END IF;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_void_entry(p_id uuid, p_reason text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Void reason required';
  END IF;
  UPDATE public.ledger_entries
  SET voided_at = now(), voided_by = auth.uid(), void_reason = btrim(p_reason)
  WHERE id = p_id AND voided_at IS NULL;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ledger entry not found or already voided';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_ledger(p_user_id uuid)
RETURNS TABLE (
  id uuid,
  kind public.ledger_kind,
  amount_uzs bigint,
  period date,
  method public.pay_method,
  occurred_on date,
  note text,
  source public.ledger_source,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  SELECT e.id, e.kind, e.amount_uzs, e.period, e.method, e.occurred_on, e.note, e.source,
         e.voided_at, e.void_reason, e.created_at
  FROM public.ledger_entries e
  WHERE e.user_id = p_user_id
  ORDER BY e.occurred_on DESC, e.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_student_balances(
  p_search text DEFAULT NULL,
  p_class_id uuid DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_kind text DEFAULT NULL,
  p_min_balance bigint DEFAULT NULL,
  p_max_balance bigint DEFAULT NULL,
  p_month date DEFAULT NULL,
  p_rank text DEFAULT NULL,
  p_months_in_debt integer DEFAULT NULL
)
RETURNS TABLE (
  user_id uuid,
  full_name text,
  username text,
  phone text,
  class_id uuid,
  class_name text,
  status public.class_member_status,
  rw smallint,
  math smallint,
  total_score integer,
  rank_letter text,
  monthly_fee bigint,
  charged bigint,
  paid bigint,
  balance bigint,
  last_payment_on date,
  months_in_debt integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  WITH base AS (
    SELECT
      m.user_id,
      p.full_name,
      p.username,
      c.phone,
      m.class_id,
      cl.name AS class_name,
      m.status,
      s.rw,
      s.math,
      COALESCE(s.rw, 0) + COALESCE(s.math, 0) AS total_score,
      public.bs_student_balance(m.user_id) AS balance,
      public.bs_fee_for_month(m.user_id, public.bs_tashkent_today()) AS monthly_fee,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = m.user_id AND e.kind = 'charge' AND e.voided_at IS NULL
      ), 0)::bigint AS charged,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = m.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ), 0)::bigint AS paid,
      (
        SELECT MAX(e.occurred_on) FROM public.ledger_entries e
        WHERE e.user_id = m.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ) AS last_payment_on
    FROM public.class_memberships m
    JOIN public.profiles p ON p.id = m.user_id
    JOIN public.classes cl ON cl.id = m.class_id
    LEFT JOIN public.student_contacts c ON c.user_id = m.user_id
    LEFT JOIN public.student_scores s ON s.user_id = m.user_id
  )
  SELECT
    b.user_id,
    b.full_name,
    b.username,
    b.phone,
    b.class_id,
    b.class_name,
    b.status,
    b.rw,
    b.math,
    b.total_score::int,
    public.bs_rank_letter(b.total_score::int),
    b.monthly_fee,
    b.charged,
    b.paid,
    b.balance,
    b.last_payment_on,
    CASE
      WHEN b.balance >= 0 THEN 0
      ELSE COALESCE((
        SELECT COUNT(DISTINCT e.period)::int
        FROM public.ledger_entries e
        WHERE e.user_id = b.user_id
          AND e.kind = 'charge'
          AND e.voided_at IS NULL
          AND e.period >= COALESCE((
            SELECT date_trunc('month', MAX(pmt.occurred_on))::date
            FROM public.ledger_entries pmt
            WHERE pmt.user_id = b.user_id AND pmt.kind = 'payment' AND pmt.voided_at IS NULL
          ), e.period)
      ), 0)
    END AS months_in_debt
  FROM base b
  WHERE (p_search IS NULL OR p_search = '' OR (
      b.full_name ILIKE '%' || p_search || '%'
      OR b.username ILIKE '%' || p_search || '%'
      OR COALESCE(b.phone, '') ILIKE '%' || p_search || '%'
    ))
    AND (p_class_id IS NULL OR b.class_id = p_class_id)
    AND (p_status IS NULL OR p_status = '' OR b.status::text = p_status)
    AND (p_kind IS NULL OR p_kind = '' OR p_kind = 'all' OR (
      (p_kind = 'debt' AND b.balance < 0)
      OR (p_kind = 'credit' AND b.balance > 0)
      OR (p_kind = 'settled' AND b.balance = 0)
    ))
    AND (p_min_balance IS NULL OR b.balance >= p_min_balance)
    AND (p_max_balance IS NULL OR b.balance <= p_max_balance)
    AND (p_rank IS NULL OR p_rank = '' OR public.bs_rank_letter(b.total_score::int) = p_rank)
    AND (
      p_month IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = b.user_id
          AND e.kind = 'charge'
          AND e.voided_at IS NULL
          AND e.period = date_trunc('month', p_month)::date
      )
    )
    AND (
      p_months_in_debt IS NULL
      OR (
        CASE
          WHEN b.balance >= 0 THEN 0
          ELSE COALESCE((
            SELECT COUNT(DISTINCT e.period)::int
            FROM public.ledger_entries e
            WHERE e.user_id = b.user_id AND e.kind = 'charge' AND e.voided_at IS NULL
          ), 0)
        END
      ) >= p_months_in_debt
    )
  ORDER BY b.balance ASC, b.full_name ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.bs_fee_for_month(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bs_member_active_in_month(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.bs_student_balance(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_set_monthly_fee(uuid, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_apply_recurring_fees(date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.billing_apply_recurring_fees_system(date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_charge_month(uuid, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_payment(uuid, bigint, public.pay_method, date, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_discount(uuid, bigint, date, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_record_refund(uuid, bigint, date, text, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_void_entry(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_student_ledger(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_student_balances(text, uuid, text, text, bigint, bigint, date, text, integer) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_set_monthly_fee(uuid, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_apply_recurring_fees(date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_recurring_fees_system(date) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_charge_month(uuid, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_payment(uuid, bigint, public.pay_method, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_discount(uuid, bigint, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_record_refund(uuid, bigint, date, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_void_entry(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_ledger(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_student_balances(text, uuid, text, text, bigint, bigint, date, text, integer) TO authenticated;
