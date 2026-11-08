-- A finished freeze (the return day is today or earlier) needs a reason.
-- The return day is the first day back, so a freeze through 29 October is stored
-- as a return on 30 October. Days strictly inside the window lose any status
-- event that would otherwise keep them billable. The reason is written on the
-- voided automatic charge and on the replacement charge note.

CREATE OR REPLACE FUNCTION public._billing_sync_freeze_months(
  p_user_id uuid,
  p_class_id uuid,
  p_from date,
  p_reason text,
  p_resumes_on date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_from)::date;
  v_end date := date_trunc('month', public.bs_tashkent_today())::date;
  v_group uuid;
  v_due record;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_why text := 'frozen';
  v_note text;
BEGIN
  IF p_from IS NULL OR v_month > v_end THEN
    RETURN;
  END IF;
  IF v_reason IS NOT NULL THEN
    v_why := 'frozen: ' || left(v_reason, 200);
  END IF;
  WHILE v_month <= v_end LOOP
    IF EXISTS (
      SELECT 1
      FROM public.ledger_entries r
      WHERE r.user_id = p_user_id
        AND r.class_id = p_class_id
        AND r.period = v_month
        AND r.kind = 'charge'
        AND r.void_reason = 'payments reset'
    ) OR EXISTS (
      SELECT 1
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id
        AND e.class_id = p_class_id
        AND e.group_id IS NULL
        AND e.kind = 'charge'
        AND e.source = 'manual'
        AND e.voided_at IS NULL
        AND e.period = v_month
    ) THEN
      v_month := (v_month + interval '1 month')::date;
      CONTINUE;
    END IF;

    FOR v_group IN
      SELECT m.group_id
      FROM public.class_group_memberships m
      WHERE m.user_id = p_user_id
        AND m.class_id = p_class_id
        AND m.status <> 'left'
    LOOP
      PERFORM public._bs_ensure_group_lessons(v_group, v_month);
    END LOOP;

    SELECT * INTO v_due FROM public._bs_class_month_billable(p_user_id, p_class_id, v_month);

    IF v_reason IS NULL AND EXISTS (
      SELECT 1
      FROM public.ledger_entries e
      WHERE e.user_id = p_user_id
        AND e.class_id = p_class_id
        AND e.group_id IS NULL
        AND e.kind = 'charge'
        AND e.source = 'auto'
        AND e.voided_at IS NULL
        AND e.period = v_month
        AND e.amount_uzs = COALESCE(v_due.amount_uzs, 0)
    ) THEN
      v_month := (v_month + interval '1 month')::date;
      CONTINUE;
    END IF;

    UPDATE public.ledger_entries e
    SET voided_at = now(),
        voided_by = auth.uid(),
        void_reason = v_why
    WHERE e.user_id = p_user_id
      AND e.class_id = p_class_id
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.period = v_month;

    IF COALESCE(v_due.amount_uzs, 0) > 0 AND COALESCE(v_due.label, '') <> '' THEN
      v_note := public._billing_charge_note(v_month, v_due.label, v_due.attended, v_due.total);
      IF v_reason IS NOT NULL AND p_resumes_on IS NOT NULL THEN
        v_note := v_note || ' · frozen '
          || to_char(p_from, 'FMDD Mon') || '-' || to_char(p_resumes_on - 1, 'FMDD Mon YYYY')
          || ': ' || v_reason;
      END IF;
      INSERT INTO public.ledger_entries (
        user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
        prorate_lessons, prorate_total, created_by
      )
      VALUES (
        p_user_id, p_class_id, NULL, 'charge', v_due.amount_uzs, v_month,
        GREATEST(v_month, p_from),
        v_note,
        'auto', v_due.attended, v_due.total, auth.uid()
      );
    END IF;

    v_month := (v_month + interval '1 month')::date;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_sync_freeze_months(uuid, uuid, date, text, date)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_realize_freeze(
  p_group_id uuid,
  p_user_id uuid,
  p_as_of date,
  p_reason text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.class_group_memberships%ROWTYPE;
  v_back public.class_member_status;
  v_from date;
  v_back_on date;
BEGIN
  SELECT * INTO v_row
  FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_row.status = 'left' OR v_row.frozen_on IS NULL THEN
    RETURN;
  END IF;
  IF v_row.frozen_on > p_as_of THEN
    RETURN;
  END IF;

  v_from := v_row.frozen_on;
  v_back_on := v_row.resumes_on;
  v_back := COALESCE(v_row.resume_status, 'active');
  IF v_back NOT IN ('active', 'trial') THEN
    v_back := 'active';
  END IF;

  IF v_back_on IS NOT NULL AND v_back_on <= p_as_of THEN
    IF v_row.status IS DISTINCT FROM 'frozen' THEN
      PERFORM set_config('bs.status_on', v_row.frozen_on::text, true);
      UPDATE public.class_group_memberships
      SET status = 'frozen'
      WHERE group_id = p_group_id AND user_id = p_user_id AND status IS DISTINCT FROM 'frozen';
      PERFORM set_config('bs.status_on', '', true);
    END IF;
    PERFORM set_config('bs.status_on', v_back_on::text, true);
    UPDATE public.class_group_memberships
    SET status = v_back,
        frozen_on = NULL,
        resumes_on = NULL,
        resume_status = NULL
    WHERE group_id = p_group_id AND user_id = p_user_id;
    PERFORM set_config('bs.status_on', '', true);
    PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from, p_reason, v_back_on);
    RETURN;
  END IF;

  IF v_row.status IS DISTINCT FROM 'frozen' THEN
    PERFORM set_config('bs.status_on', v_row.frozen_on::text, true);
    UPDATE public.class_group_memberships
    SET status = 'frozen'
    WHERE group_id = p_group_id AND user_id = p_user_id AND status IS DISTINCT FROM 'frozen';
    PERFORM set_config('bs.status_on', '', true);
  END IF;
  PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from, p_reason, v_back_on);
END;
$$;

REVOKE ALL ON FUNCTION public._billing_realize_freeze(uuid, uuid, date, text)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_apply_due_freezes(p_as_of date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of date := COALESCE(p_as_of, public.bs_tashkent_today());
  v_row record;
BEGIN
  FOR v_row IN
    SELECT m.group_id, m.user_id
    FROM public.class_group_memberships m
    WHERE m.frozen_on IS NOT NULL
      AND m.frozen_on <= v_as_of
      AND m.status <> 'left'
      AND (
        m.status <> 'frozen'
        OR (m.resumes_on IS NOT NULL AND m.resumes_on <= v_as_of)
      )
  LOOP
    PERFORM public._billing_realize_freeze(v_row.group_id, v_row.user_id, v_as_of, NULL);
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.staff_activate_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.class_group_memberships%ROWTYPE;
  v_status public.class_member_status;
  v_from date;
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_row
  FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_row.status = 'left' THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF v_row.status <> 'frozen' AND v_row.frozen_on IS NULL THEN
    RAISE EXCEPTION 'Student is not frozen';
  END IF;

  IF v_row.status <> 'frozen' THEN
    UPDATE public.class_group_memberships
    SET frozen_on = NULL, resumes_on = NULL, resume_status = NULL
    WHERE group_id = p_group_id AND user_id = p_user_id;
    RETURN;
  END IF;

  v_status := COALESCE(p_status, v_row.resume_status, 'active');
  IF v_status NOT IN ('active', 'trial') THEN
    v_status := 'active';
  END IF;
  v_from := COALESCE(v_row.frozen_on, public.bs_tashkent_today());

  PERFORM set_config('bs.status_on', public.bs_tashkent_today()::text, true);
  UPDATE public.class_group_memberships
  SET status = v_status,
      frozen_on = NULL,
      resumes_on = NULL,
      resume_status = NULL
  WHERE group_id = p_group_id AND user_id = p_user_id;
  PERFORM set_config('bs.status_on', '', true);
  PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from, NULL, NULL);
END;
$$;

DROP FUNCTION IF EXISTS public._billing_realize_freeze(uuid, uuid, date);
DROP FUNCTION IF EXISTS public._billing_sync_freeze_months(uuid, uuid, date);

CREATE OR REPLACE FUNCTION public.staff_freeze_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_frozen_on date,
  p_resumes_on date DEFAULT NULL,
  p_reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.class_group_memberships%ROWTYPE;
  v_keep public.class_member_status;
  v_reason text := NULLIF(btrim(p_reason), '');
  v_today date := public.bs_tashkent_today();
BEGIN
  IF public.bs_is_self_banned() OR NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required' USING ERRCODE = '42501';
  END IF;
  IF p_frozen_on IS NULL THEN
    RAISE EXCEPTION 'A freeze start date is required';
  END IF;
  IF p_resumes_on IS NOT NULL AND p_resumes_on <= p_frozen_on THEN
    RAISE EXCEPTION 'Activation date must be after the freeze start';
  END IF;
  IF v_reason IS NULL THEN
    IF p_resumes_on IS NOT NULL AND p_resumes_on <= v_today THEN
      RAISE EXCEPTION 'A finished freeze needs a reason';
    END IF;
  ELSE
    IF p_resumes_on IS NULL THEN
      RAISE EXCEPTION 'A past freeze needs an end date';
    END IF;
    IF p_resumes_on > v_today THEN
      RAISE EXCEPTION 'A past freeze must already have ended';
    END IF;
    IF char_length(v_reason) > 200 THEN
      RAISE EXCEPTION 'The reason must be 200 characters or fewer';
    END IF;
  END IF;

  SELECT * INTO v_row
  FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_row.status = 'left' THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;

  IF v_reason IS NOT NULL THEN
    DELETE FROM public.class_membership_events ev
    WHERE ev.user_id = p_user_id
      AND ev.group_id = p_group_id
      AND ev.kind = 'status'
      AND ev.effective_on > p_frozen_on
      AND ev.effective_on < p_resumes_on;
  END IF;

  IF v_row.status IN ('active', 'trial') THEN
    v_keep := v_row.status;
  ELSE
    v_keep := COALESCE(v_row.resume_status, 'active');
  END IF;

  UPDATE public.class_group_memberships
  SET frozen_on = p_frozen_on,
      resumes_on = p_resumes_on,
      resume_status = v_keep
  WHERE group_id = p_group_id AND user_id = p_user_id;

  PERFORM public._billing_realize_freeze(p_group_id, p_user_id, v_today, v_reason);
END;
$$;

DROP FUNCTION IF EXISTS public.staff_freeze_group_member(uuid, uuid, date, date);

REVOKE ALL ON FUNCTION public.staff_freeze_group_member(uuid, uuid, date, date, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_freeze_group_member(uuid, uuid, date, date, text) TO authenticated;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261108000003', 'past_freeze')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
