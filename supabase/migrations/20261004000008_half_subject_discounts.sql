-- SQB review can show the right choice after a correct answer.
-- Next class charges use half the class fee per subject.
-- Discounts, student balance, homework video, and the SATashkent pack.

CREATE OR REPLACE FUNCTION public.get_attempt_feedback(
  p_session_id uuid,
  p_question_id uuid
)
RETURNS TABLE(
  correct_choice_id text,
  correct_grid_answers text[],
  explanation text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM public.attempts a
      JOIN public.test_sessions s ON s.id = a.session_id
     WHERE a.session_id = p_session_id
       AND a.question_id = p_question_id
       AND a.user_id = auth.uid()
       AND s.user_id = auth.uid()
       AND s.type IN ('practice', 'daily')
       AND s.mock_exam_id IS NULL
       AND s.metadata->'question_ids' @> to_jsonb(p_question_id::text)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT q.correct_choice_id, q.correct_grid_answers, q.explanation
      FROM public.questions q
     WHERE q.id = p_question_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_attempt_feedback(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attempt_feedback(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.bs_half_subject_amount(p_fee bigint, p_subjects integer)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_fee IS NULL OR p_fee <= 0 OR p_subjects IS NULL OR p_subjects <= 0 THEN 0
    ELSE LEAST(p_fee, (p_fee * LEAST(p_subjects, 2)) / 2)
  END;
$$;

REVOKE ALL ON FUNCTION public.bs_half_subject_amount(bigint, integer) FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS public.student_discounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('percent', 'amount')),
  value bigint NOT NULL CHECK (value > 0),
  ends_on date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, class_id)
);

ALTER TABLE public.student_discounts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.student_discounts FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bs_apply_discount(
  p_user_id uuid,
  p_class_id uuid,
  p_amount bigint,
  p_on date
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mode text;
  v_value bigint;
  v_ends date;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN COALESCE(p_amount, 0);
  END IF;
  SELECT d.mode, d.value, d.ends_on
    INTO v_mode, v_value, v_ends
  FROM public.student_discounts d
  WHERE d.user_id = p_user_id
    AND d.class_id = p_class_id
    AND (d.ends_on IS NULL OR d.ends_on >= p_on)
  LIMIT 1;
  IF v_mode IS NULL THEN
    RETURN p_amount;
  END IF;
  IF v_mode = 'percent' THEN
    RETURN GREATEST(0, p_amount - (p_amount * LEAST(v_value, 100)) / 100);
  END IF;
  RETURN GREATEST(0, p_amount - v_value);
END;
$$;

REVOKE ALL ON FUNCTION public.bs_apply_discount(uuid, uuid, bigint, date) FROM PUBLIC, anon, authenticated;

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
  WHERE m.user_id = p_user_id AND m.class_id = p_class_id AND m.status <> 'left';
  IF v_activated IS NULL OR v_month < date_trunc('month', v_activated)::date THEN
    RETURN NULL;
  END IF;
  FOR v_group IN
    SELECT group_id FROM public.class_group_memberships
    WHERE user_id = p_user_id AND class_id = p_class_id AND status <> 'left'
  LOOP
    IF public.bs_member_active_in_group_month(p_user_id, v_group, v_month) THEN
      v_active := true;
    END IF;
  END LOOP;
  IF NOT v_active AND p_source = 'auto' THEN
    RETURN NULL;
  END IF;
  SELECT COUNT(DISTINCT g.subject)::int INTO v_subjects
  FROM public.class_group_memberships m
  JOIN public.class_groups g ON g.id = m.group_id
  WHERE m.user_id = p_user_id AND g.class_id = p_class_id AND m.status <> 'left';
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

CREATE OR REPLACE FUNCTION public.bs_can_edit_discount(p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.bs_is_admin() OR public.bs_teaches_student(p_user_id);
$$;

REVOKE ALL ON FUNCTION public.bs_can_edit_discount(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.admin_set_student_discount(
  p_user_id uuid,
  p_class_id uuid,
  p_mode text,
  p_value bigint,
  p_ends_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_can_edit_discount(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF p_mode NOT IN ('percent', 'amount') THEN
    RAISE EXCEPTION 'Discount must be a percent or a sum';
  END IF;
  IF p_mode = 'percent' AND (p_value < 1 OR p_value > 100) THEN
    RAISE EXCEPTION 'Percent must be between 1 and 100';
  END IF;
  IF p_mode = 'amount' AND (p_value < 1000 OR p_value > 100000000) THEN
    RAISE EXCEPTION 'Amount must be between 1 000 and 100 000 000 UZS';
  END IF;
  INSERT INTO public.student_discounts (user_id, class_id, mode, value, ends_on, created_by)
  VALUES (p_user_id, p_class_id, p_mode, p_value, p_ends_on, auth.uid())
  ON CONFLICT (user_id, class_id) DO UPDATE
    SET mode = EXCLUDED.mode,
        value = EXCLUDED.value,
        ends_on = EXCLUDED.ends_on,
        created_by = EXCLUDED.created_by,
        created_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clear_student_discount(p_user_id uuid, p_class_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.bs_can_edit_discount(p_user_id) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  DELETE FROM public.student_discounts
  WHERE user_id = p_user_id AND class_id = p_class_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_student_discounts()
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  class_id uuid,
  class_name text,
  mode text,
  value bigint,
  ends_on date
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT d.id, d.user_id, p.full_name, d.class_id, c.name, d.mode, d.value, d.ends_on
  FROM public.student_discounts d
  JOIN public.profiles p ON p.id = d.user_id
  JOIN public.classes c ON c.id = d.class_id
  WHERE public.bs_is_admin() OR public.bs_teaches_student(d.user_id)
  ORDER BY p.full_name, c.name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_student_discount(uuid, uuid, text, bigint, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_clear_student_discount(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_student_discounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_student_discount(uuid, uuid, text, bigint, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_clear_student_discount(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_student_discounts() TO authenticated;

CREATE OR REPLACE FUNCTION public.student_billing_home()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  RETURN jsonb_build_object(
    'balance', public.bs_student_balance(v_uid),
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'kind', r.kind,
        'amount_uzs', r.amount_uzs::text,
        'note', r.note,
        'occurred_on', r.occurred_on
      ) ORDER BY r.occurred_on DESC, r.created_at DESC)
      FROM (
        SELECT e.id, e.kind, e.amount_uzs, e.note, e.occurred_on, e.created_at
        FROM public.ledger_entries e
        WHERE e.user_id = v_uid AND e.voided_at IS NULL
        ORDER BY e.occurred_on DESC, e.created_at DESC
        LIMIT 8
      ) r
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.student_billing_home() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_billing_home() TO authenticated;

ALTER TABLE public.homework_assignments
  ADD COLUMN IF NOT EXISTS video_url text;

INSERT INTO public.lesson_subjects (slug, title, sort_order, icon)
VALUES ('satashkent', 'SATashkent', 2, 'play')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.lesson_topics (subject_id, title, sort_order, description)
SELECT s.id, 'Full course', 0, 'SATashkent video lessons.'
FROM public.lesson_subjects s
WHERE s.slug = 'satashkent'
  AND NOT EXISTS (
    SELECT 1 FROM public.lesson_topics t WHERE t.subject_id = s.id AND t.title = 'Full course'
  );

INSERT INTO public.lessons (topic_id, title, sort_order, body, video_url, published)
SELECT t.id, 'SATashkent course', 0,
  'Watch the SATashkent course. Open a lesson to play the video.',
  'https://www.youtube.com/watch?v=7pifl33P_rw&list=PLLGFrV7SE5K4',
  true
FROM public.lesson_topics t
JOIN public.lesson_subjects s ON s.id = t.subject_id
WHERE s.slug = 'satashkent' AND t.title = 'Full course'
  AND NOT EXISTS (
    SELECT 1 FROM public.lessons l WHERE l.topic_id = t.id AND l.title = 'SATashkent course'
  );


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
                SELECT COUNT(DISTINCT g2.subject)::int
                FROM public.class_group_memberships gm2
                JOIN public.class_groups g2 ON g2.id = gm2.group_id
                WHERE gm2.user_id = pr.user_id
                  AND g2.class_id = pr.class_id
                  AND gm2.status <> 'left'
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

CREATE OR REPLACE FUNCTION public.admin_discount_students()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  class_id uuid,
  class_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  RETURN QUERY
  SELECT DISTINCT m.user_id, p.full_name, c.id, c.name
  FROM public.class_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  JOIN public.classes c ON c.id = m.class_id
  WHERE m.status <> 'left'
    AND (public.bs_is_admin() OR public.bs_teaches_student(m.user_id))
  ORDER BY p.full_name, c.name;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_discount_students() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_discount_students() TO authenticated;
