-- Restores the old-class days a move wiped, then rewrites the new class from the move day.

CREATE OR REPLACE FUNCTION public.repair_moved_class_charges()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
  v_group record;
  v_span record;
  v_move date;
  v_sum bigint;
  v_labels text;
  v_new uuid;
  v_new_sum bigint;
  v_new_labels text;
  v_cut bigint;
  v_wrote int := 0;
BEGIN
  FOR v_row IN
    SELECT DISTINCT e.user_id, e.class_id, e.period
    FROM public.ledger_entries e
    WHERE e.kind = 'charge'
      AND e.void_reason = 'moved'
      AND e.period IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries live
        WHERE live.user_id = e.user_id
          AND live.class_id = e.class_id
          AND live.period = e.period
          AND live.kind = 'charge'
          AND live.group_id IS NULL
          AND live.voided_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries reset
        WHERE reset.user_id = e.user_id
          AND reset.class_id = e.class_id
          AND reset.period = e.period
          AND reset.kind = 'charge'
          AND reset.void_reason = 'payments reset'
      )
  LOOP
    SELECT max(ev.effective_on) INTO v_move
    FROM public.class_membership_events ev
    WHERE ev.user_id = v_row.user_id
      AND ev.class_id = v_row.class_id
      AND ev.status = 'left'
      AND ev.effective_on >= v_row.period
      AND ev.effective_on < (v_row.period + interval '1 month')::date;

    v_sum := 0;
    v_labels := '';
    IF v_move IS NOT NULL THEN
      FOR v_group IN
        SELECT g.group_id,
               COALESCE(
                 (
                   SELECT max(left_ev.effective_on)
                   FROM public.class_membership_events left_ev
                   WHERE left_ev.user_id = v_row.user_id
                     AND left_ev.group_id = g.group_id
                     AND left_ev.status = 'left'
                     AND left_ev.effective_on >= v_row.period
                     AND left_ev.effective_on < (v_row.period + interval '1 month')::date
                 ),
                 v_move
               ) AS left_on
        FROM (
          SELECT DISTINCT ev.group_id
          FROM public.class_membership_events ev
          WHERE ev.user_id = v_row.user_id
            AND ev.class_id = v_row.class_id
            AND ev.group_id IS NOT NULL
        ) g
      LOOP
        SELECT * INTO v_span
        FROM public._billing_group_span(
          v_row.user_id, v_group.group_id, v_row.period, v_row.period, v_group.left_on - 1
        );
        IF COALESCE(v_span.amount, 0) <= 0 THEN
          CONTINUE;
        END IF;
        v_sum := v_sum + v_span.amount;
        v_labels := CASE WHEN v_labels = '' THEN v_span.label ELSE v_labels || ' + ' || v_span.label END;
      END LOOP;
    END IF;

    IF v_sum > 0 AND v_labels <> '' THEN
      INSERT INTO public.ledger_entries (
        user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
      )
      VALUES (
        v_row.user_id, v_row.class_id, NULL, 'charge', v_sum, v_row.period,
        COALESCE(v_move, v_row.period) - 1,
        public._billing_charge_note(v_row.period, v_labels, NULL, NULL),
        'manual', auth.uid()
      );
      v_wrote := v_wrote + 1;
    END IF;

    IF v_move IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_new IN
      SELECT DISTINCT ev.class_id
      FROM public.class_membership_events ev
      WHERE ev.user_id = v_row.user_id
        AND ev.class_id <> v_row.class_id
        AND ev.status = 'active'
        AND ev.effective_on = v_move
        AND EXISTS (
          SELECT 1 FROM public.ledger_entries live
          WHERE live.user_id = v_row.user_id
            AND live.class_id = ev.class_id
            AND live.period = v_row.period
            AND live.kind = 'charge'
            AND live.group_id IS NULL
            AND live.source = 'auto'
            AND live.voided_at IS NULL
        )
    LOOP
      v_new_sum := 0;
      v_new_labels := '';
      FOR v_group IN
        SELECT m.group_id, COALESCE(m.activated_on, m.enrolled_on) AS started_on
        FROM public.class_group_memberships m
        WHERE m.user_id = v_row.user_id
          AND m.class_id = v_new
          AND m.status <> 'left'
      LOOP
        SELECT * INTO v_span
        FROM public._billing_group_span(
          v_row.user_id,
          v_group.group_id,
          v_row.period,
          GREATEST(v_move, COALESCE(v_group.started_on, v_move)),
          (v_row.period + interval '1 month')::date - 1
        );
        IF COALESCE(v_span.amount, 0) <= 0 THEN
          CONTINUE;
        END IF;
        v_new_sum := v_new_sum + v_span.amount;
        v_new_labels := CASE
          WHEN v_new_labels = '' THEN v_span.label
          ELSE v_new_labels || ' + ' || v_span.label
        END;
      END LOOP;

      v_cut := COALESCE(public._bs_both_amount_cut(v_row.user_id, v_new, v_row.period), 0);
      v_new_sum := GREATEST(0, v_new_sum - v_cut);
      IF v_new_sum <= 0 OR v_new_labels = '' THEN
        CONTINUE;
      END IF;

      UPDATE public.ledger_entries e
      SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
      WHERE e.user_id = v_row.user_id
        AND e.class_id = v_new
        AND e.period = v_row.period
        AND e.kind = 'charge'
        AND e.group_id IS NULL
        AND e.source = 'auto'
        AND e.voided_at IS NULL
        AND e.amount_uzs IS DISTINCT FROM v_new_sum;

      IF EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = v_row.user_id
          AND e.class_id = v_new
          AND e.period = v_row.period
          AND e.kind = 'charge'
          AND e.group_id IS NULL
          AND e.voided_at IS NULL
      ) THEN
        CONTINUE;
      END IF;

      INSERT INTO public.ledger_entries (
        user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
      )
      VALUES (
        v_row.user_id, v_new, NULL, 'charge', v_new_sum, v_row.period, v_move,
        public._billing_charge_note(v_row.period, v_new_labels, NULL, NULL),
        'manual', auth.uid()
      );
      v_wrote := v_wrote + 1;
    END LOOP;
  END LOOP;
  RETURN v_wrote;
END;
$$;

REVOKE ALL ON FUNCTION public.repair_moved_class_charges() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.repair_moved_class_charges() TO service_role;

DO $$
DECLARE
  v_first integer;
  v_second integer;
BEGIN
  v_first := public.repair_moved_class_charges();
  v_second := public.repair_moved_class_charges();
  IF v_second <> 0 THEN
    RAISE EXCEPTION 'Move repair wrote % rows on the second run', v_second;
  END IF;
  IF v_first < 0 THEN
    RAISE EXCEPTION 'Move repair failed';
  END IF;
END $$;

-- The first draft of the repair also shortened SAT 13, which those students
-- still attend. Put the October charge back and leave the move split alone.
UPDATE public.ledger_entries e
SET voided_at = now(), voided_by = auth.uid(), void_reason = 'repriced'
FROM public.profiles p, public.classes c
WHERE e.user_id = p.id
  AND e.class_id = c.id
  AND c.name = 'SAT 13'
  AND e.period = '2026-10-01'
  AND e.kind = 'charge'
  AND e.group_id IS NULL
  AND e.voided_at IS NULL
  AND e.source = 'manual'
  AND e.note = 'Course fee · October 2026 · SAT 13 Eng 3/13'
  AND COALESCE(p.full_name, p.username) IN ('Eshnazarova Durdona', 'Xushboqov Sardor');

INSERT INTO public.ledger_entries (
  user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source, created_by
)
SELECT p.id, c.id, NULL, 'charge', v.amount_uzs, '2026-10-01', '2026-10-01', v.note, 'auto', auth.uid()
FROM (VALUES
  ('Eshnazarova Durdona', 507692, 'Course fee · October 2026 · SAT 13 Eng 11/13'),
  ('Xushboqov Sardor', 380769, 'Course fee · October 2026 · SAT 13 Eng 11/13')
) AS v(student, amount_uzs, note)
JOIN public.profiles p ON COALESCE(p.full_name, p.username) = v.student
JOIN public.classes c ON c.name = 'SAT 13'
WHERE NOT EXISTS (
  SELECT 1 FROM public.ledger_entries e
  WHERE e.user_id = p.id
    AND e.class_id = c.id
    AND e.period = '2026-10-01'
    AND e.kind = 'charge'
    AND e.group_id IS NULL
    AND e.voided_at IS NULL
);

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261028000002', 'repair_moved_charges')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';

SELECT count(*) AS still_missing_old_month
FROM (
  SELECT DISTINCT e.user_id, e.class_id, e.period
  FROM public.ledger_entries e
  WHERE e.void_reason = 'moved'
    AND e.period IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ledger_entries live
      WHERE live.user_id = e.user_id
        AND live.class_id = e.class_id
        AND live.period = e.period
        AND live.kind = 'charge'
        AND live.group_id IS NULL
        AND live.voided_at IS NULL
    )
) missing;
