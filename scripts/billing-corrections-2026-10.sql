-- October 2026 corrections found by scripts/billing-audit.sql. Dry run: every row is
-- a proposed change; nothing is written.
-- English in SAT 12 starts on its own activation date, but never before the day the
-- student left SAT 10 English (SAT 10 already billed the days before that).
WITH oct AS (SELECT date '2026-10-01' AS m),
sat12 AS (SELECT id FROM public.classes WHERE name = 'SAT 12'),
sat13 AS (SELECT id FROM public.classes WHERE name = 'SAT 13'),
movers AS (
  SELECT e.id AS row_id, e.user_id, e.class_id, e.amount_uzs AS charged, e.note
  FROM public.ledger_entries e, sat12, oct
  WHERE e.class_id = sat12.id AND e.period = oct.m AND e.kind = 'charge'
    AND e.voided_at IS NULL AND e.group_id IS NULL AND e.source = 'manual'
    AND e.note LIKE '%SAT 12 Eng 3/13%'
),
starts AS (
  SELECT mv.row_id, m.group_id, g.name, g.subject,
         GREATEST(
           COALESCE(m.activated_on, m.enrolled_on),
           COALESCE((
             SELECT max(ev.effective_on)
             FROM public.class_membership_events ev
             JOIN public.class_groups og ON og.id = ev.group_id
             WHERE ev.user_id = mv.user_id AND ev.status = 'left' AND ev.kind = 'status'
               AND og.subject = g.subject AND og.class_id <> mv.class_id
               AND ev.effective_on >= date '2026-10-01' AND ev.effective_on < date '2026-11-01'
           ), date '2026-10-01')
         ) AS bill_from
  FROM movers mv
  JOIN public.class_group_memberships m ON m.user_id = mv.user_id AND m.class_id = mv.class_id
  JOIN public.class_groups g ON g.id = m.group_id
),
spans AS (
  SELECT s.*, sp.amount, sp.label
  FROM starts s
  CROSS JOIN LATERAL public._billing_group_span(
    (SELECT user_id FROM movers WHERE row_id = s.row_id), s.group_id, date '2026-10-01', s.bill_from, date '2026-10-31'
  ) sp
),
proposed AS (
  SELECT mv.row_id, mv.user_id, mv.class_id, mv.charged, mv.note AS old_note,
         GREATEST(0, sum(sp.amount) - COALESCE(public._bs_both_amount_cut(mv.user_id, mv.class_id, date '2026-10-01'), 0)) AS new_amount,
         string_agg(sp.label, ' + ' ORDER BY sp.subject) AS new_labels,
         jsonb_object_agg(sp.group_id, sp.bill_from) AS group_starts
  FROM movers mv JOIN spans sp ON sp.row_id = mv.row_id
  GROUP BY mv.row_id, mv.user_id, mv.class_id, mv.charged, mv.note
),
bektashev AS (
  SELECT e.id AS row_id, e.user_id, e.class_id, e.amount_uzs AS charged, e.note AS old_note,
         p.amount_uzs AS new_amount,
         p.group_name || CASE WHEN p.remaining IS NOT NULL THEN ' ' || p.remaining || '/' || p.total ELSE '' END AS new_labels,
         NULL::jsonb AS group_starts
  FROM public.ledger_entries e
  JOIN public.profiles pr ON pr.id = e.user_id AND pr.full_name = 'Bektashev Asilbek'
  JOIN sat13 ON sat13.id = e.class_id
  JOIN public.class_groups g ON g.class_id = sat13.id AND g.subject = 'ebrw'
  CROSS JOIN LATERAL public.bs_subject_month_part(e.user_id, g.id, date '2026-10-01') p
  WHERE e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL
    AND e.group_id IS NULL AND e.note LIKE '%SAT 13 Maths 3/14%'
)
SELECT COALESCE(pr.full_name, pr.username) AS student, x.charged, x.new_amount,
       x.new_amount - x.charged AS change, x.old_note, x.new_labels, x.group_starts
FROM (SELECT * FROM proposed UNION ALL SELECT * FROM bektashev) x
JOIN public.profiles pr ON pr.id = x.user_id
ORDER BY 1;
