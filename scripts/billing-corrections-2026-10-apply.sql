-- Applies the rows listed by scripts/billing-corrections-2026-10.sql. Each wrong October
-- charge is voided with reason 'corrected' and replaced by the corrected manual charge.
-- Activation dates are set to the day billing really starts so later prorations agree.
CREATE TEMP TABLE corr AS
WITH sat12 AS (SELECT id FROM public.classes WHERE name = 'SAT 12'),
sat13 AS (SELECT id FROM public.classes WHERE name = 'SAT 13'),
movers AS (
  SELECT e.id AS row_id, e.user_id, e.class_id
  FROM public.ledger_entries e, sat12
  WHERE e.class_id = sat12.id AND e.period = date '2026-10-01' AND e.kind = 'charge'
    AND e.voided_at IS NULL AND e.group_id IS NULL AND e.source = 'manual'
    AND e.note LIKE '%SAT 12 Eng 3/13%'
),
starts AS (
  SELECT mv.row_id, mv.user_id, m.group_id, g.subject,
         COALESCE(m.activated_on, m.enrolled_on) AS activated_on,
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
  CROSS JOIN LATERAL public._billing_group_span(s.user_id, s.group_id, date '2026-10-01', s.bill_from, date '2026-10-31') sp
)
SELECT mv.row_id, mv.user_id, mv.class_id,
       GREATEST(0, sum(sp.amount) - COALESCE(public._bs_both_amount_cut(mv.user_id, mv.class_id, date '2026-10-01'), 0)) AS new_amount,
       string_agg(sp.label, ' + ' ORDER BY sp.subject) AS new_labels
FROM movers mv JOIN spans sp ON sp.row_id = mv.row_id
GROUP BY mv.row_id, mv.user_id, mv.class_id
UNION ALL
SELECT e.id, e.user_id, e.class_id, p.amount_uzs,
       p.group_name || CASE WHEN p.remaining IS NOT NULL THEN ' ' || p.remaining || '/' || p.total ELSE '' END
FROM public.ledger_entries e
JOIN public.profiles pr ON pr.id = e.user_id AND pr.full_name = 'Bektashev Asilbek'
JOIN sat13 ON sat13.id = e.class_id
JOIN public.class_groups g ON g.class_id = sat13.id AND g.subject = 'ebrw'
CROSS JOIN LATERAL public.bs_subject_month_part(e.user_id, g.id, date '2026-10-01') p
WHERE e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL
  AND e.group_id IS NULL AND e.note LIKE '%SAT 13 Maths 3/14%';

CREATE TEMP TABLE corr_starts AS
SELECT m.user_id, m.group_id,
       GREATEST(COALESCE(m.activated_on, m.enrolled_on), (
         SELECT max(ev.effective_on)
         FROM public.class_membership_events ev
         JOIN public.class_groups og ON og.id = ev.group_id
         WHERE ev.user_id = m.user_id AND ev.status = 'left' AND ev.kind = 'status'
           AND og.subject = m.subject AND og.class_id <> m.class_id
           AND ev.effective_on >= date '2026-10-01' AND ev.effective_on < date '2026-11-01'
       )) AS bill_from,
       COALESCE(m.activated_on, m.enrolled_on) AS activated_on
FROM public.class_group_memberships m
WHERE m.user_id IN (SELECT user_id FROM corr)
  AND m.class_id IN (SELECT id FROM public.classes WHERE name = 'SAT 12');

DO $$
DECLARE
  v_row record;
  v_count int := 0;
BEGIN
  IF (SELECT count(*) FROM corr) <> 7 THEN
    RAISE EXCEPTION 'Expected 7 corrections, found %', (SELECT count(*) FROM corr);
  END IF;
  FOR v_row IN SELECT * FROM corr LOOP
    UPDATE public.ledger_entries
    SET voided_at = now(), void_reason = 'corrected'
    WHERE id = v_row.row_id AND voided_at IS NULL;
    INSERT INTO public.ledger_entries (
      user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source
    )
    VALUES (
      v_row.user_id, v_row.class_id, NULL, 'charge', v_row.new_amount, date '2026-10-01',
      public.bs_tashkent_today(),
      public._billing_charge_note(date '2026-10-01', v_row.new_labels, NULL, NULL),
      'manual'
    );
    v_count := v_count + 1;
  END LOOP;

  UPDATE public.class_group_memberships m
  SET activated_on = s.bill_from
  FROM corr_starts s
  WHERE m.user_id = s.user_id AND m.group_id = s.group_id
    AND s.bill_from IS NOT NULL AND s.bill_from > s.activated_on;

  UPDATE public.class_group_memberships m
  SET activated_on = date '2026-10-25'
  FROM public.profiles p, public.class_groups g
  WHERE p.id = m.user_id AND p.full_name = 'Eshnazarova Durdona'
    AND g.id = m.group_id AND g.name = 'SAT 12 Maths'
    AND m.activated_on < date '2026-10-25';
END $$;

SELECT COALESCE(p.full_name, p.username) AS student, e.amount_uzs, e.note
FROM public.ledger_entries e
JOIN public.profiles p ON p.id = e.user_id
WHERE e.user_id IN (SELECT user_id FROM corr)
  AND e.period = date '2026-10-01' AND e.kind = 'charge' AND e.voided_at IS NULL
ORDER BY 1, 3;
