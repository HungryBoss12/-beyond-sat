-- A student in two classes is one balance row. Class and status filters still match either class.

CREATE OR REPLACE FUNCTION public.admin_student_balances(
  p_search text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
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
  groups jsonb,
  rw smallint,
  math smallint,
  total_score integer,
  rank_letter text,
  monthly_fee bigint,
  charged bigint,
  paid bigint,
  balance bigint,
  last_payment_on date,
  months_in_debt integer,
  recent jsonb
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today date := public.bs_tashkent_today();
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  RETURN QUERY
  WITH people AS (
    SELECT m.user_id FROM public.class_memberships m
    UNION
    SELECT e.user_id FROM public.ledger_entries e
  ),
  base AS (
    SELECT
      pp.user_id,
      p.full_name,
      p.username,
      sc.phone,
      membership.class_id,
      membership.class_name,
      membership.status,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', g.id, 'name', g.name, 'subject', g.subject, 'status', gm.status,
          'activated_on', gm.activated_on
        ) ORDER BY g.name, g.subject)
        FROM public.class_group_memberships gm
        JOIN public.class_groups g ON g.id = gm.group_id
        WHERE gm.user_id = pp.user_id
      ), '[]'::jsonb) AS groups,
      s.rw,
      s.math,
      COALESCE(s.rw, 0) + COALESCE(s.math, 0) AS total_score,
      public.bs_student_balance(pp.user_id) AS balance,
      (
        SELECT SUM(public.bs_group_fee_for_month(pp.user_id, gm.group_id, v_today))
        FROM public.class_group_memberships gm
        WHERE gm.user_id = pp.user_id
      )::bigint AS monthly_fee,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'charge' AND e.voided_at IS NULL
      ), 0)::bigint AS charged,
      COALESCE((
        SELECT SUM(e.amount_uzs) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ), 0)::bigint AS paid,
      (
        SELECT MAX(e.occurred_on) FROM public.ledger_entries e
        WHERE e.user_id = pp.user_id AND e.kind = 'payment' AND e.voided_at IS NULL
      ) AS last_payment_on,
      COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', r.id, 'kind', r.kind, 'amount_uzs', r.amount_uzs::text,
          'note', r.note, 'occurred_on', r.occurred_on, 'source', r.source
        ) ORDER BY r.occurred_on DESC, r.created_at DESC)
        FROM (
          SELECT e.id, e.kind, e.amount_uzs, e.note, e.occurred_on, e.source, e.created_at
          FROM public.ledger_entries e
          WHERE e.user_id = pp.user_id AND e.voided_at IS NULL
          ORDER BY e.occurred_on DESC, e.created_at DESC
          LIMIT 4
        ) r
      ), '[]'::jsonb) AS recent
    FROM people pp
    JOIN public.profiles p ON p.id = pp.user_id
    LEFT JOIN LATERAL (
      SELECT
        (array_agg(m.class_id ORDER BY cl.name))[1] AS class_id,
        string_agg(cl.name, ', ' ORDER BY cl.name) AS class_name,
        (array_agg(m.status ORDER BY
          CASE m.status WHEN 'active' THEN 0 WHEN 'trial' THEN 1 ELSE 2 END,
          cl.name
        ))[1] AS status
      FROM public.class_memberships m
      JOIN public.classes cl ON cl.id = m.class_id
      WHERE m.user_id = pp.user_id
    ) membership ON true
    LEFT JOIN public.student_contacts sc ON sc.user_id = pp.user_id
    LEFT JOIN public.student_scores s ON s.user_id = pp.user_id
  ),
  debt AS (
    SELECT
      b.*,
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
  )
  SELECT
    d.user_id, d.full_name, d.username, d.phone, d.class_id, d.class_name, d.status, d.groups,
    d.rw, d.math, d.total_score::int, public.bs_rank_letter(d.total_score::int),
    d.monthly_fee, d.charged, d.paid, d.balance, d.last_payment_on, d.months_in_debt, d.recent
  FROM debt d
  WHERE (p_search IS NULL OR p_search = '' OR (
      d.full_name ILIKE '%' || p_search || '%'
      OR d.username ILIKE '%' || p_search || '%'
      OR COALESCE(d.phone, '') ILIKE '%' || p_search || '%'
    ))
    AND (p_group_id IS NULL OR EXISTS (
      SELECT 1 FROM public.class_group_memberships gm
      WHERE gm.user_id = d.user_id AND gm.group_id = p_group_id
    ))
    AND (p_class_id IS NULL OR EXISTS (
      SELECT 1 FROM public.class_memberships m
      WHERE m.user_id = d.user_id AND m.class_id = p_class_id
    ))
    AND (p_status IS NULL OR p_status = '' OR EXISTS (
      SELECT 1 FROM public.class_memberships m
      WHERE m.user_id = d.user_id AND m.status::text = p_status
    ))
    AND (p_kind IS NULL OR p_kind = '' OR p_kind = 'all' OR (
      (p_kind = 'debt' AND d.balance < 0)
      OR (p_kind = 'credit' AND d.balance > 0)
      OR (p_kind = 'settled' AND d.balance = 0)
    ))
    AND (p_min_balance IS NULL OR d.balance >= p_min_balance)
    AND (p_max_balance IS NULL OR d.balance <= p_max_balance)
    AND (p_rank IS NULL OR p_rank = '' OR public.bs_rank_letter(d.total_score::int) = p_rank)
    AND (
      p_month IS NULL
      OR EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = d.user_id
          AND e.kind = 'charge'
          AND e.voided_at IS NULL
          AND e.period = date_trunc('month', p_month)::date
      )
    )
    AND (p_months_in_debt IS NULL OR d.months_in_debt >= p_months_in_debt)
  ORDER BY d.balance ASC, d.full_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_student_balances(text, uuid, uuid, text, text, bigint, bigint, date, text, integer) TO authenticated;
