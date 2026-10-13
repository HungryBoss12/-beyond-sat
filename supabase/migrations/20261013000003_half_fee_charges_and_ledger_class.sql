-- One-subject students were charged the full class fee for a prorated month.
-- The ledger is append-only, so void the full charge and write the half.
-- Two-subject charges stay.

DO $$
DECLARE
  v_row record;
  v_half bigint;
BEGIN
  FOR v_row IN
    SELECT e.id, e.user_id, e.class_id, e.group_id, e.period, e.occurred_on, e.note,
           e.source, e.prorate_lessons, e.prorate_total, e.created_by,
           round(
             public.bs_half_subject_amount(
               COALESCE(
                 public.bs_class_fee_for_month(e.class_id, e.period),
                 public.bs_class_fee_for_month(e.class_id, public.bs_tashkent_today())
               ),
               1
             )::numeric * e.prorate_lessons / e.prorate_total
           )::bigint AS half_amount
    FROM public.ledger_entries e
    WHERE e.kind = 'charge'
      AND e.voided_at IS NULL
      AND e.prorate_lessons IS NOT NULL
      AND e.prorate_total > e.prorate_lessons
      AND (
        SELECT count(DISTINCT c.subject)
        FROM public.bs_counted_groups(e.user_id) c
        WHERE c.class_id = e.class_id
      ) = 1
      AND (
        e.amount_uzs = round(1200000::numeric * e.prorate_lessons / e.prorate_total)::bigint
        OR e.amount_uzs = round(1000000::numeric * e.prorate_lessons / e.prorate_total)::bigint
        OR e.amount_uzs = round(
          COALESCE(
            public.bs_class_fee_for_month(e.class_id, e.period),
            public.bs_class_fee_for_month(e.class_id, public.bs_tashkent_today())
          )::numeric * e.prorate_lessons / e.prorate_total
        )::bigint
      )
      AND e.amount_uzs IS DISTINCT FROM round(
        public.bs_half_subject_amount(
          COALESCE(
            public.bs_class_fee_for_month(e.class_id, e.period),
            public.bs_class_fee_for_month(e.class_id, public.bs_tashkent_today())
          ),
          1
        )::numeric * e.prorate_lessons / e.prorate_total
      )::bigint
  LOOP
    v_half := v_row.half_amount;
    IF v_half IS NULL OR v_half <= 0 THEN
      CONTINUE;
    END IF;
    UPDATE public.ledger_entries
    SET voided_at = now(),
        void_reason = 'One subject pays half the class fee'
    WHERE id = v_row.id;
    INSERT INTO public.ledger_entries (
      user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
      prorate_lessons, prorate_total, created_by
    ) VALUES (
      v_row.user_id, v_row.class_id, v_row.group_id, 'charge', v_half, v_row.period,
      v_row.occurred_on, v_row.note, v_row.source, v_row.prorate_lessons, v_row.prorate_total,
      v_row.created_by
    );
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS public.admin_student_ledger(uuid);

CREATE FUNCTION public.admin_student_ledger(p_user_id uuid)
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
  created_at timestamptz,
  group_id uuid,
  group_name text,
  subject public.class_subject,
  prorate_lessons smallint,
  prorate_total smallint,
  class_id uuid
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
         e.voided_at, e.void_reason, e.created_at, e.group_id, g.name, g.subject,
         e.prorate_lessons, e.prorate_total, e.class_id
  FROM public.ledger_entries e
  LEFT JOIN public.class_groups g ON g.id = e.group_id
  WHERE e.user_id = p_user_id
  ORDER BY e.occurred_on DESC, e.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_student_ledger(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_ledger(uuid) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261013000003', 'half_fee_charges_and_ledger_class')
ON CONFLICT (version) DO NOTHING;
