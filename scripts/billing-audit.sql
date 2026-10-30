-- Read-only billing invariants. Every row is a violation; an empty result is a pass.
-- Run: npx supabase db query --linked -f scripts/billing-audit.sql

WITH
open_month AS (
  SELECT date_trunc('month', public.bs_tashkent_today())::date AS m
),
live AS (
  SELECT e.id, e.user_id, e.class_id, e.period, e.amount_uzs, e.source, e.note,
         split_part(e.note, ' · ', 3) AS body
  FROM public.ledger_entries e
  WHERE e.kind = 'charge' AND e.voided_at IS NULL AND e.group_id IS NULL
    AND e.note LIKE 'Course fee · %'
),
pieces AS (
  SELECT l.*, trim(x) AS piece,
         (regexp_match(trim(x), '(\d+)/(\d+)$'))[1]::int AS rem,
         trim(regexp_replace(trim(x), '\s*\d+/\d+$', '')) AS gname
  FROM live l
  CROSS JOIN LATERAL unnest(string_to_array(l.body, ' + ')) x
),
piece_groups AS (
  SELECT p.*, g.id AS group_id, g.subject
  FROM pieces p
  JOIN public.class_groups g ON g.name = p.gname AND g.class_id = p.class_id
),

-- A0: an open-month auto charge must equal the formula.
a0 AS (
  SELECT 'open month charge differs from formula'::text AS check_name,
         l.user_id,
         format('%s: charged %s, formula %s', cl.name, l.amount_uzs, f.due) AS detail
  FROM live l
  JOIN open_month o ON l.period = o.m
  JOIN public.classes cl ON cl.id = l.class_id
  CROSS JOIN LATERAL (
    SELECT GREATEST(0, COALESCE((
      SELECT sum(p.amount_uzs)
      FROM public.bs_counted_groups(l.user_id) c
      CROSS JOIN LATERAL public.bs_subject_month_part(l.user_id, c.group_id, l.period) p
      WHERE c.class_id = l.class_id
    ), 0) - COALESCE(public._bs_both_amount_cut(l.user_id, l.class_id, l.period), 0)) AS due
  ) f
  WHERE l.source = 'auto' AND f.due IS DISTINCT FROM l.amount_uzs
),

-- A1: a manual piece for a group the student is still in must not bill fewer lessons than the group's start allows.
a1 AS (
  SELECT 'manual piece billed below group start',
         pg.user_id,
         format('%s %s: charged %s, should be %s/%s', to_char(pg.period, 'YYYY-MM'), pg.piece,
                COALESCE(pg.rem::text, 'full'), part.remaining, part.total)
  FROM piece_groups pg
  CROSS JOIN LATERAL public.bs_subject_month_part(pg.user_id, pg.group_id, pg.period) part
  WHERE pg.source = 'manual'
    AND EXISTS (SELECT 1 FROM public.bs_counted_groups(pg.user_id) c WHERE c.group_id = pg.group_id)
    AND part.remaining IS NOT NULL
    AND COALESCE(pg.rem, part.total) < part.remaining
),

-- Billing windows per group stay, from membership events.
stays AS (
  SELECT ev.user_id, ev.class_id, ev.group_id, g.subject, g.name AS gname,
         ev.effective_on AS joined_on,
         (
           SELECT min(nx.effective_on)
           FROM public.class_membership_events nx
           WHERE nx.user_id = ev.user_id AND nx.group_id = ev.group_id
             AND nx.kind = 'status' AND nx.status = 'left'
             AND (nx.effective_on, nx.created_at) > (ev.effective_on, ev.created_at)
         ) AS left_on,
         ev.created_at
  FROM public.class_membership_events ev
  JOIN public.class_groups g ON g.id = ev.group_id
  WHERE ev.kind = 'status' AND ev.status = 'active'
),
windows AS (
  SELECT s.*,
         GREATEST(s.joined_on, COALESCE((
           SELECT a.effective_on
           FROM public.class_membership_events a
           WHERE a.user_id = s.user_id AND a.group_id = s.group_id AND a.kind = 'activation'
             AND a.created_at >= s.created_at
           ORDER BY a.created_at DESC
           LIMIT 1
         ), s.joined_on)) AS bill_from,
         COALESCE(s.left_on - 1, date '9999-12-31') AS bill_to
  FROM stays s
),

-- A2: one subject billed in two classes over the same days.
a2 AS (
  SELECT DISTINCT 'same subject billed in two classes',
         w1.user_id,
         format('%s and %s overlap %s to %s', w1.gname, w2.gname,
                GREATEST(w1.bill_from, w2.bill_from), LEAST(w1.bill_to, w2.bill_to))
  FROM windows w1
  JOIN windows w2
    ON w2.user_id = w1.user_id AND w2.subject = w1.subject AND w2.class_id <> w1.class_id
   AND w1.gname < w2.gname
  WHERE GREATEST(w1.bill_from, w2.bill_from) <= LEAST(w1.bill_to, w2.bill_to)
    AND EXISTS (
      SELECT 1 FROM piece_groups a
      JOIN piece_groups b ON b.user_id = a.user_id AND b.period = a.period
      WHERE a.user_id = w1.user_id AND a.group_id = w1.group_id AND b.group_id = w2.group_id
        AND a.period = date_trunc('month', GREATEST(w1.bill_from, w2.bill_from))::date
    )
    AND EXISTS (
      SELECT 1 FROM public.class_lessons l
      WHERE l.group_id IN (w1.group_id, w2.group_id)
        AND l.lesson_date BETWEEN GREATEST(w1.bill_from, w2.bill_from) AND LEAST(w1.bill_to, w2.bill_to)
    )
),

-- A3: a month spent entirely frozen must carry no charge for that group.
frozen_spans AS (
  SELECT f.user_id, f.class_id, f.group_id, g.name AS gname, f.effective_on AS frozen_on,
         (
           SELECT min(nx.effective_on)
           FROM public.class_membership_events nx
           WHERE nx.user_id = f.user_id AND nx.group_id = f.group_id
             AND nx.kind = 'status' AND nx.status <> 'frozen'
             AND (nx.effective_on, nx.created_at) > (f.effective_on, f.created_at)
         ) AS thawed_on
  FROM public.class_membership_events f
  JOIN public.class_groups g ON g.id = f.group_id
  WHERE f.kind = 'status' AND f.status = 'frozen'
),
a3 AS (
  SELECT 'charge in a fully frozen month',
         pg.user_id,
         format('%s %s', to_char(pg.period, 'YYYY-MM'), pg.piece)
  FROM piece_groups pg
  JOIN frozen_spans fs ON fs.user_id = pg.user_id AND fs.group_id = pg.group_id
  WHERE fs.frozen_on <= pg.period
    AND COALESCE(fs.thawed_on, date '9999-12-31') > (pg.period + interval '1 month' - interval '1 day')::date
),

-- A4: a closed month must not be voided and rebuilt by an automatic reprice or an activation edit.
a4 AS (
  SELECT 'closed month rebuilt',
         e.user_id,
         format('%s %s voided %s (%s), was %s', cl.name, to_char(e.period, 'YYYY-MM'),
                to_char(e.voided_at AT TIME ZONE 'Asia/Tashkent', 'YYYY-MM-DD HH24:MI'),
                e.void_reason, e.amount_uzs)
  FROM public.ledger_entries e
  JOIN public.classes cl ON cl.id = e.class_id
  WHERE e.kind = 'charge'
    AND e.void_reason IN ('repriced', 'activation date changed')
    AND e.period < date_trunc('month', e.voided_at AT TIME ZONE 'Asia/Tashkent')::date
    AND e.voided_at >= timestamptz '2026-10-24 00:00+05'
),

-- A5: an activation date earlier than joining, while another class billed that subject the same month.
a5 AS (
  SELECT 'activation before joining overlaps another class',
         m.user_id,
         format('%s activated %s, joined %s; %s also billed', g.name, m.activated_on, m.enrolled_on, other.piece)
  FROM public.class_group_memberships m
  JOIN public.class_groups g ON g.id = m.group_id
  JOIN piece_groups other
    ON other.user_id = m.user_id AND other.class_id <> m.class_id AND other.subject = g.subject
   AND other.period = date_trunc('month', m.enrolled_on)::date
  WHERE m.status <> 'left'
    AND m.activated_on < m.enrolled_on
    AND date_trunc('month', m.activated_on) = date_trunc('month', m.enrolled_on)
)

SELECT r.check_name, COALESCE(p.full_name, p.username, r.user_id::text) AS student, r.detail
FROM (
  SELECT * FROM a0
  UNION ALL SELECT * FROM a1
  UNION ALL SELECT * FROM a2
  UNION ALL SELECT * FROM a3
  UNION ALL SELECT * FROM a4
  UNION ALL SELECT * FROM a5
) r
LEFT JOIN public.profiles p ON p.id = r.user_id
ORDER BY 1, 2, 3;
