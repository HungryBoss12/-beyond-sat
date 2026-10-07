-- Unused student setup links expire. Old roster rows with no login lose their invites.
-- A link can stay dark until activates_at. Monthly fees count only the two
-- earliest groups; Eng+Math inside those two is still one class fee.

ALTER TABLE public.student_invites
  ADD COLUMN IF NOT EXISTS activates_at timestamptz NOT NULL DEFAULT now();

UPDATE public.student_invites si
SET expires_at = now()
WHERE si.used_at IS NULL
  AND si.expires_at > now()
  AND NOT EXISTS (
    SELECT 1
    FROM public.students s
    JOIN public.user_roles r ON r.user_id = s.user_id AND r.role = 'teacher'
    WHERE s.id = si.student_id
  );

DELETE FROM public.student_invites si
USING public.students s
WHERE si.student_id = s.id
  AND s.user_id IS NULL;

CREATE OR REPLACE FUNCTION public.bs_counted_groups(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  subject public.class_subject,
  enrolled_on date,
  joined_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.group_id, m.class_id, g.subject, m.enrolled_on, m.joined_at
  FROM public.class_group_memberships m
  JOIN public.class_groups g ON g.id = m.group_id
  WHERE m.user_id = p_user_id
    AND m.status <> 'left'
  ORDER BY m.enrolled_on, m.joined_at, m.group_id
  LIMIT 2;
$$;

REVOKE ALL ON FUNCTION public.bs_counted_groups(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bs_group_fee_for_month(p_user_id uuid, p_group_id uuid, p_month date)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN counted.subjects IS NULL OR counted.subjects = 0 THEN NULL
    WHEN counted.subjects >= 2 AND g.subject = 'math'
      THEN public.bs_class_fee_for_month(g.class_id, p_month)
    WHEN counted.subjects = 1
      THEN public.bs_half_subject_amount(public.bs_class_fee_for_month(g.class_id, p_month), 1)
    ELSE NULL
  END
  FROM public.class_groups g
  LEFT JOIN LATERAL (
    SELECT COUNT(DISTINCT c.subject)::int AS subjects
    FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = g.class_id
      AND EXISTS (
        SELECT 1 FROM public.bs_counted_groups(p_user_id) mine
        WHERE mine.group_id = p_group_id
      )
  ) counted ON true
  WHERE g.id = p_group_id;
$$;

REVOKE ALL ON FUNCTION public.bs_group_fee_for_month(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_charge_class_month(
  p_user_id uuid,
  p_class_id uuid,
  p_month date,
  p_source public.ledger_source
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_name text;
  v_activated date;
  v_fee bigint;
  v_override bigint;
  v_amount bigint;
  v_remaining int;
  v_total int;
  v_active boolean := false;
  v_group uuid;
  v_id uuid;
  v_subjects int;
BEGIN
  SELECT min(m.activated_on) INTO v_activated
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left'
    AND m.group_id IN (SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c);
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  FOR v_group IN
    SELECT c.group_id FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = p_class_id
  LOOP
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(DISTINCT c.subject)::int INTO v_subjects
  FROM public.bs_counted_groups(p_user_id) c
  WHERE c.class_id = p_class_id;
  v_override := public.bs_student_class_override(p_user_id, p_class_id, v_month);
  v_fee := public.bs_half_subject_amount(
    COALESCE(v_override, public.bs_class_fee_for_month(p_class_id, v_month)),
    v_subjects
  );
  IF v_fee IS NULL OR v_fee <= 0 THEN
    RETURN NULL;
  END IF;
  SELECT name INTO v_name FROM public.classes WHERE id = p_class_id;
  v_amount := v_fee;
  IF v_month = date_trunc('month', v_activated)::date THEN
    SELECT j.amount_uzs, j.remaining, j.total INTO v_amount, v_remaining, v_total
    FROM public.bs_class_join_month_charge(p_class_id, v_activated, v_fee) j;
    IF v_total = 0 OR v_remaining = v_total THEN
      v_remaining := NULL;
      v_total := NULL;
    END IF;
  END IF;
  v_amount := public.bs_apply_discount(p_user_id, p_class_id, v_amount, v_month);
  IF v_amount IS NULL OR v_amount <= 0 THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.ledger_entries (
    user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
    prorate_lessons, prorate_total, created_by
  )
  VALUES (
    p_user_id, p_class_id, NULL, 'charge', v_amount, v_month,
    CASE WHEN p_source = 'manual' THEN public.bs_tashkent_today()
         WHEN v_remaining IS NOT NULL THEN v_activated
         ELSE v_month END,
    public._billing_charge_note(v_month, v_name, v_remaining, v_total),
    p_source, v_remaining, v_total, auth.uid()
  )
  ON CONFLICT (user_id, class_id, period) WHERE kind = 'charge' AND voided_at IS NULL AND group_id IS NULL
  DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_charge_class_month(uuid, uuid, date, public.ledger_source)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_student_billing(p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  class_id uuid,
  group_name text,
  subject public.class_subject,
  status public.class_member_status,
  enrolled_on date,
  activated_on date,
  monthly_fee_uzs bigint,
  override_fee_uzs bigint,
  join_amount_uzs bigint,
  join_remaining integer,
  join_total integer,
  charged_uzs bigint,
  charge_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_join record;
  v_today date := public.bs_tashkent_today();
  v_fee bigint;
  v_override bigint;
  v_subjects int;
  v_show boolean;
BEGIN
  IF NOT public.bs_is_admin() THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;
  FOR v_row IN
    SELECT m.*, g.name AS gname,
      row_number() OVER (
        PARTITION BY m.class_id
        ORDER BY CASE WHEN g.subject = 'math' THEN 0 ELSE 1 END, g.name
      ) AS class_rank
    FROM public.class_group_memberships m
    JOIN public.class_groups g ON g.id = m.group_id
    WHERE m.user_id = p_user_id
    ORDER BY g.name, g.subject
  LOOP
    group_id := v_row.group_id;
    class_id := v_row.class_id;
    group_name := v_row.gname;
    subject := v_row.subject;
    status := v_row.status;
    enrolled_on := v_row.enrolled_on;
    activated_on := v_row.activated_on;
    override_fee_uzs := NULL;
    monthly_fee_uzs := NULL;
    join_amount_uzs := NULL;
    join_remaining := NULL;
    join_total := NULL;
    charged_uzs := 0;
    charge_count := 0;
    SELECT COUNT(DISTINCT c.subject)::int INTO v_subjects
    FROM public.bs_counted_groups(p_user_id) c
    WHERE c.class_id = v_row.class_id;
    v_show := EXISTS (
      SELECT 1 FROM public.bs_counted_groups(p_user_id) c WHERE c.group_id = v_row.group_id
    ) AND (
      (v_subjects >= 2 AND v_row.subject = 'math') OR v_subjects = 1
    );
    IF v_show THEN
      v_override := public.bs_student_class_override(p_user_id, v_row.class_id, v_today);
      v_fee := public.bs_half_subject_amount(
        COALESCE(v_override, public.bs_class_fee_for_month(v_row.class_id, v_today)),
        v_subjects
      );
      override_fee_uzs := v_override;
      monthly_fee_uzs := v_fee;
      IF v_row.activated_on IS NOT NULL AND v_fee IS NOT NULL AND v_fee > 0 THEN
        SELECT j.* INTO v_join
        FROM public.bs_class_join_month_charge(v_row.class_id, v_row.activated_on, v_fee) j;
        join_amount_uzs := v_join.amount_uzs;
        join_remaining := v_join.remaining;
        join_total := v_join.total;
      END IF;
    END IF;
    IF v_row.class_rank = 1 THEN
      SELECT COALESCE(SUM(e.amount_uzs), 0)::bigint, count(*)::int INTO charged_uzs, charge_count
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id AND e.class_id = v_row.class_id
        AND e.group_id IS NULL AND e.kind = 'charge' AND e.voided_at IS NULL;
    END IF;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_student_billing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_student_billing(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.admin_student_balances(text, uuid, uuid, text, text, bigint, bigint, date, text, integer);

CREATE FUNCTION public.admin_student_balances(
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
  monthly_tuition bigint,
  expected_this_month bigint,
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
#variable_conflict use_column
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
  priced AS (
    SELECT
      gm.user_id,
      g.class_id,
      COALESCE(
        public.bs_student_class_override(gm.user_id, g.class_id, v_today),
        public.bs_class_fee_for_month(g.class_id, v_today),
        0
      ) AS fee,
      MIN(gm.activated_on) AS activated
    FROM public.class_group_memberships gm
    JOIN public.class_groups g ON g.id = gm.group_id
    WHERE gm.status <> 'left'
    GROUP BY gm.user_id, g.class_id
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
          'activated_on', gm.activated_on, 'class_id', g.class_id
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
      (
        SELECT MAX(pr.fee)
        FROM priced pr
        WHERE pr.user_id = pp.user_id AND pr.fee > 0
      )::bigint AS monthly_tuition,
      COALESCE((
        SELECT SUM(
          public.bs_apply_discount(
            pr.user_id,
            pr.class_id,
            public.bs_half_subject_amount(
              public.bs_expected_class_charge(pr.class_id, pr.activated, pr.fee, v_today),
              (
                SELECT COUNT(DISTINCT c.subject)::int
                FROM public.bs_counted_groups(pr.user_id) c
                WHERE c.class_id = pr.class_id
              )
            ),
            v_today
          )
        )
        FROM priced pr
        WHERE pr.user_id = pp.user_id
      ), 0)::bigint AS expected_this_month,
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
    d.monthly_fee, d.monthly_tuition, d.expected_this_month,
    d.charged, d.paid, d.balance, d.last_payment_on, d.months_in_debt, d.recent
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

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261008000001', 'invite_timing_and_fee_cap')
ON CONFLICT (version) DO NOTHING;
