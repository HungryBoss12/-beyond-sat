-- A freeze names the day it started and, optionally, the day the student comes back.
-- Between those days the sub-class adds nothing to the class fee. Lessons before the
-- start, and lessons from the return day, stay on the bill. A month spent entirely
-- inside the window loses its automatic charge. A charge entered by hand stays.
-- An empty return date waits for staff to activate. The hourly fee job applies a
-- start or a return once that day has arrived.

ALTER TABLE public.class_group_memberships
  ADD COLUMN IF NOT EXISTS frozen_on date,
  ADD COLUMN IF NOT EXISTS resumes_on date,
  ADD COLUMN IF NOT EXISTS resume_status public.class_member_status;

ALTER TABLE public.class_group_memberships
  DROP CONSTRAINT IF EXISTS class_group_memberships_freeze_window;
ALTER TABLE public.class_group_memberships
  ADD CONSTRAINT class_group_memberships_freeze_window CHECK (
    (
      frozen_on IS NULL
      AND resumes_on IS NULL
      AND resume_status IS NULL
    )
    OR (
      frozen_on IS NOT NULL
      AND (resumes_on IS NULL OR resumes_on > frozen_on)
      AND (resume_status IS NULL OR resume_status IN ('active', 'trial'))
    )
  );

COMMENT ON COLUMN public.class_group_memberships.frozen_on IS
  'First day this sub-class stops counting toward the fee. Null when not frozen and not scheduled.';
COMMENT ON COLUMN public.class_group_memberships.resumes_on IS
  'Day the student becomes active again. Null means they stay frozen until someone activates them.';
COMMENT ON COLUMN public.class_group_memberships.resume_status IS
  'Status restored on thaw: active or trial.';

CREATE OR REPLACE FUNCTION public.class_group_memberships_after()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_left date := public.bs_tashkent_today();
  v_on date := public.bs_tashkent_today();
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.enrolled_on, auth.uid());
    PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    INSERT INTO public.chat_thread_members (thread_id, user_id)
    SELECT t.id, NEW.user_id
    FROM public.chat_threads t
    WHERE t.class_id = NEW.class_id AND t.kind = 'subject_group' AND t.subject = NEW.subject
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      BEGIN
        IF NULLIF(current_setting('bs.status_on', true), '') IS NOT NULL THEN
          v_on := NULLIF(current_setting('bs.status_on', true), '')::date;
        END IF;
      EXCEPTION
        WHEN invalid_datetime_format OR datetime_field_overflow THEN
          v_on := public.bs_tashkent_today();
      END;
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, v_on, auth.uid());
      PERFORM public.bs_sync_parent_membership(NEW.class_id, NEW.user_id);
    END IF;
    IF NEW.activated_on IS DISTINCT FROM OLD.activated_on AND NEW.activated_on IS NOT NULL THEN
      INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by, kind)
      VALUES (NEW.user_id, NEW.class_id, NEW.group_id, NEW.status, NEW.activated_on, auth.uid(), 'activation');
    END IF;
    RETURN NEW;
  ELSE
    BEGIN
      IF NULLIF(current_setting('bs.left_on', true), '') IS NOT NULL THEN
        v_left := NULLIF(current_setting('bs.left_on', true), '')::date;
      END IF;
    EXCEPTION
      WHEN invalid_datetime_format OR datetime_field_overflow THEN
        v_left := public.bs_tashkent_today();
    END;
    INSERT INTO public.class_membership_events (user_id, class_id, group_id, status, effective_on, changed_by)
    SELECT OLD.user_id, OLD.class_id, OLD.group_id, 'left', v_left, auth.uid()
    WHERE EXISTS (SELECT 1 FROM public.class_groups g WHERE g.id = OLD.group_id)
      AND EXISTS (SELECT 1 FROM public.classes c WHERE c.id = OLD.class_id);
    PERFORM public.bs_sync_parent_membership(OLD.class_id, OLD.user_id);
    DELETE FROM public.chat_thread_members m
    USING public.chat_threads t
    WHERE m.thread_id = t.id
      AND m.user_id = OLD.user_id
      AND t.class_id = OLD.class_id
      AND t.kind = 'subject_group'
      AND t.subject = OLD.subject
      AND NOT public._bs_user_is_staff(OLD.user_id);
    RETURN OLD;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._bs_group_status_on(p_user_id uuid, p_group_id uuid, p_day date)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT ev.status::text
      FROM public.class_membership_events ev
      WHERE ev.user_id = p_user_id
        AND ev.group_id = p_group_id
        AND ev.kind = 'status'
        AND ev.effective_on <= p_day
      ORDER BY ev.effective_on DESC, ev.created_at DESC
      LIMIT 1
    ),
    (
      SELECT m.status::text
      FROM public.class_group_memberships m
      WHERE m.user_id = p_user_id
        AND m.group_id = p_group_id
        AND m.enrolled_on <= p_day
    )
  );
$$;

REVOKE ALL ON FUNCTION public._bs_group_status_on(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- Lessons on days the student was active or on trial, from their billing start.
-- No lessons in a month that still has an active day is the full subject share.
-- A month with no active day is free.
CREATE OR REPLACE FUNCTION public._bs_group_month_billable(
  p_user_id uuid,
  p_group_id uuid,
  p_month date
)
RETURNS TABLE(amount_uzs bigint, attended integer, total integer, group_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_last date := (date_trunc('month', p_month) + interval '1 month')::date - 1;
  v_class uuid;
  v_subject text;
  v_name text;
  v_start date;
  v_share bigint;
  v_total int;
  v_attended int;
  v_day date;
  v_open boolean := false;
BEGIN
  amount_uzs := 0;
  attended := NULL;
  total := NULL;
  group_name := NULL;

  SELECT g.class_id, g.subject::text, g.name
    INTO v_class, v_subject, v_name
  FROM public.class_groups g
  WHERE g.id = p_group_id;
  IF v_class IS NULL THEN
    RETURN NEXT;
    RETURN;
  END IF;
  group_name := v_name;

  SELECT COALESCE(m.activated_on, m.enrolled_on)
    INTO v_start
  FROM public.class_group_memberships m
  WHERE m.user_id = p_user_id
    AND m.group_id = p_group_id
    AND m.status <> 'left';
  IF v_start IS NULL OR v_month < date_trunc('month', v_start)::date THEN
    RETURN NEXT;
    RETURN;
  END IF;

  v_share := public._bs_subject_share(p_user_id, v_class, v_subject, v_month);
  IF COALESCE(v_share, 0) <= 0 THEN
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT count(*)::int,
         count(*) FILTER (
           WHERE l.lesson_date >= v_start
             AND public._bs_group_status_on(p_user_id, p_group_id, l.lesson_date) IN ('active', 'trial')
         )::int
    INTO v_total, v_attended
  FROM public.class_lessons l
  WHERE l.group_id = p_group_id
    AND l.lesson_date >= v_month
    AND l.lesson_date < (v_month + interval '1 month')::date;

  IF COALESCE(v_total, 0) <= 0 THEN
    v_day := GREATEST(v_month, v_start);
    WHILE v_day <= v_last LOOP
      IF public._bs_group_status_on(p_user_id, p_group_id, v_day) IN ('active', 'trial') THEN
        v_open := true;
        EXIT;
      END IF;
      v_day := v_day + 1;
    END LOOP;
    amount_uzs := CASE WHEN v_open THEN v_share ELSE 0 END;
    RETURN NEXT;
    RETURN;
  END IF;

  IF COALESCE(v_attended, 0) <= 0 THEN
    amount_uzs := 0;
  ELSIF v_attended < v_total THEN
    amount_uzs := round(v_share::numeric * v_attended / v_total)::bigint;
    attended := v_attended;
    total := v_total;
  ELSE
    amount_uzs := v_share;
  END IF;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public._bs_group_month_billable(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._bs_class_month_billable(
  p_user_id uuid,
  p_class_id uuid,
  p_month date,
  OUT amount_uzs bigint,
  OUT label text,
  OUT attended integer,
  OUT total integer
)
RETURNS record
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_month date := date_trunc('month', p_month)::date;
  v_group uuid;
  v_part record;
  v_piece text;
  v_sum bigint := 0;
  v_labels text := '';
  v_rem int;
  v_tot int;
  v_mixed boolean := false;
BEGIN
  amount_uzs := 0;
  label := '';
  attended := NULL;
  total := NULL;

  FOR v_group IN
    SELECT m.group_id
    FROM public.class_group_memberships m
    WHERE m.user_id = p_user_id
      AND m.class_id = p_class_id
      AND m.status <> 'left'
  LOOP
    SELECT * INTO v_part FROM public._bs_group_month_billable(p_user_id, v_group, v_month);
    IF COALESCE(v_part.amount_uzs, 0) <= 0 THEN
      CONTINUE;
    END IF;
    v_sum := v_sum + v_part.amount_uzs;
    v_piece := v_part.group_name;
    IF v_part.attended IS NOT NULL THEN
      v_piece := v_piece || ' ' || v_part.attended || '/' || v_part.total;
      IF v_rem IS NULL THEN
        v_rem := v_part.attended;
        v_tot := v_part.total;
      ELSIF v_rem IS DISTINCT FROM v_part.attended OR v_tot IS DISTINCT FROM v_part.total THEN
        v_mixed := true;
      END IF;
    END IF;
    v_labels := CASE WHEN v_labels = '' THEN v_piece ELSE v_labels || ' + ' || v_piece END;
  END LOOP;

  v_sum := GREATEST(0, v_sum - COALESCE(public._bs_both_amount_cut(p_user_id, p_class_id, v_month), 0));
  IF v_sum <= 0 OR v_labels = '' THEN
    RETURN;
  END IF;
  IF v_mixed THEN
    v_rem := NULL;
    v_tot := NULL;
  END IF;
  amount_uzs := v_sum;
  label := v_labels;
  attended := v_rem;
  total := v_tot;
END;
$$;

REVOKE ALL ON FUNCTION public._bs_class_month_billable(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- True when any still-enrolled sub-class is frozen on some day of the month.
CREATE OR REPLACE FUNCTION public._bs_class_month_has_freeze(p_user_id uuid, p_class_id uuid, p_month date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH bounds AS (
    SELECT date_trunc('month', p_month)::date AS first_day,
           ((date_trunc('month', p_month) + interval '1 month')::date - 1) AS last_day
  )
  SELECT EXISTS (
    SELECT 1
    FROM public.class_group_memberships m, bounds b
    WHERE m.user_id = p_user_id
      AND m.class_id = p_class_id
      AND m.status <> 'left'
      AND (
        public._bs_group_status_on(m.user_id, m.group_id, b.first_day) = 'frozen'
        OR EXISTS (
          SELECT 1
          FROM public.class_membership_events ev
          WHERE ev.user_id = m.user_id
            AND ev.group_id = m.group_id
            AND ev.kind = 'status'
            AND ev.status = 'frozen'
            AND ev.effective_on > b.first_day
            AND ev.effective_on <= b.last_day
        )
      )
  );
$$;

REVOKE ALL ON FUNCTION public._bs_class_month_has_freeze(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

-- Rewrites automatic class charges from p_from through this month so frozen days drop out.
-- A manual charge, including one locked by the older freeze path, is left in place.
CREATE OR REPLACE FUNCTION public._billing_sync_freeze_months(p_user_id uuid, p_class_id uuid, p_from date)
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
BEGIN
  IF p_from IS NULL OR v_month > v_end THEN
    RETURN;
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

    IF EXISTS (
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
        void_reason = 'frozen'
    WHERE e.user_id = p_user_id
      AND e.class_id = p_class_id
      AND e.group_id IS NULL
      AND e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.period = v_month;

    IF COALESCE(v_due.amount_uzs, 0) > 0 AND COALESCE(v_due.label, '') <> '' THEN
      INSERT INTO public.ledger_entries (
        user_id, class_id, group_id, kind, amount_uzs, period, occurred_on, note, source,
        prorate_lessons, prorate_total, created_by
      )
      VALUES (
        p_user_id, p_class_id, NULL, 'charge', v_due.amount_uzs, v_month,
        GREATEST(v_month, p_from),
        public._billing_charge_note(v_month, v_due.label, v_due.attended, v_due.total),
        'auto', v_due.attended, v_due.total, auth.uid()
      );
    END IF;

    v_month := (v_month + interval '1 month')::date;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_sync_freeze_months(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public._billing_realize_freeze(p_group_id uuid, p_user_id uuid, p_as_of date)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.class_group_memberships%ROWTYPE;
  v_back public.class_member_status;
  v_from date;
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
  v_back := COALESCE(v_row.resume_status, 'active');
  IF v_back NOT IN ('active', 'trial') THEN
    v_back := 'active';
  END IF;

  IF v_row.resumes_on IS NOT NULL AND v_row.resumes_on <= p_as_of THEN
    IF v_row.status IS DISTINCT FROM 'frozen' THEN
      PERFORM set_config('bs.status_on', v_row.frozen_on::text, true);
      UPDATE public.class_group_memberships
      SET status = 'frozen'
      WHERE group_id = p_group_id AND user_id = p_user_id AND status IS DISTINCT FROM 'frozen';
      PERFORM set_config('bs.status_on', '', true);
    END IF;
    PERFORM set_config('bs.status_on', v_row.resumes_on::text, true);
    UPDATE public.class_group_memberships
    SET status = v_back,
        frozen_on = NULL,
        resumes_on = NULL,
        resume_status = NULL
    WHERE group_id = p_group_id AND user_id = p_user_id;
    PERFORM set_config('bs.status_on', '', true);
    PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from);
    RETURN;
  END IF;

  IF v_row.status IS DISTINCT FROM 'frozen' THEN
    PERFORM set_config('bs.status_on', v_row.frozen_on::text, true);
    UPDATE public.class_group_memberships
    SET status = 'frozen'
    WHERE group_id = p_group_id AND user_id = p_user_id AND status IS DISTINCT FROM 'frozen';
    PERFORM set_config('bs.status_on', '', true);
  END IF;
  PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from);
END;
$$;

REVOKE ALL ON FUNCTION public._billing_realize_freeze(uuid, uuid, date) FROM PUBLIC, anon, authenticated;

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
    PERFORM public._billing_realize_freeze(v_row.group_id, v_row.user_id, v_as_of);
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._billing_apply_due_freezes(date) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.staff_freeze_group_member(
  p_group_id uuid,
  p_user_id uuid,
  p_frozen_on date,
  p_resumes_on date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.class_group_memberships%ROWTYPE;
  v_keep public.class_member_status;
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
  SELECT * INTO v_row
  FROM public.class_group_memberships
  WHERE group_id = p_group_id AND user_id = p_user_id;
  IF NOT FOUND OR v_row.status = 'left' THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
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

  PERFORM public._billing_realize_freeze(p_group_id, p_user_id, public.bs_tashkent_today());
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

  -- A start date that has not arrived yet is only a schedule. Clearing it cancels the freeze.
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
  PERFORM public._billing_sync_freeze_months(p_user_id, v_row.class_id, v_from);
END;
$$;

REVOKE ALL ON FUNCTION public.staff_freeze_group_member(uuid, uuid, date, date) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.staff_activate_group_member(uuid, uuid, public.class_member_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_freeze_group_member(uuid, uuid, date, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_activate_group_member(uuid, uuid, public.class_member_status) TO authenticated;

-- The one-click status change still locks this month when it freezes. Leaving
-- frozen that way clears a scheduled window so the hourly job does not freeze them again.
CREATE OR REPLACE FUNCTION public.staff_set_group_member_status(
  p_group_id uuid,
  p_user_id uuid,
  p_status public.class_member_status
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old public.class_member_status;
  v_class uuid;
BEGIN
  IF NOT (public.bs_is_staff() OR public.bs_teaches_group(p_group_id)) THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  SELECT m.status, m.class_id INTO v_old, v_class
  FROM public.class_group_memberships m
  WHERE m.group_id = p_group_id AND m.user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF p_status IS DISTINCT FROM 'frozen' THEN
    UPDATE public.class_group_memberships
    SET frozen_on = NULL, resumes_on = NULL, resume_status = NULL
    WHERE group_id = p_group_id AND user_id = p_user_id;
  END IF;
  IF p_status = 'frozen' AND v_old IS DISTINCT FROM 'frozen' THEN
    PERFORM public._billing_lock_open_month(p_user_id, v_class, 'frozen');
  END IF;
  PERFORM public._bs_upsert_group_member(p_group_id, p_user_id, p_status, NULL, NULL);
  IF v_old = 'frozen' AND p_status <> 'frozen' THEN
    PERFORM public._billing_reprice_open_month(p_user_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._billing_apply_recurring_fees(p_as_of date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_as_of date := COALESCE(p_as_of, public.bs_tashkent_today());
  v_row record;
  v_month date;
  v_end date := date_trunc('month', v_as_of)::date;
  v_due bigint;
  v_added int := 0;
BEGIN
  PERFORM public._billing_apply_due_freezes(v_as_of);

  FOR v_row IN
    SELECT e.id, e.user_id, e.class_id, e.period, e.amount_uzs
    FROM public.ledger_entries e
    WHERE e.kind = 'charge'
      AND e.source = 'auto'
      AND e.voided_at IS NULL
      AND e.group_id IS NULL
      AND e.period = v_end
      AND EXISTS (
        SELECT 1 FROM public.bs_counted_groups(e.user_id) c
        WHERE c.class_id = e.class_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.ledger_entries r
        WHERE r.user_id = e.user_id
          AND r.class_id IS NOT DISTINCT FROM e.class_id
          AND r.period IS NOT DISTINCT FROM e.period
          AND r.kind = 'charge'
          AND r.void_reason = 'payments reset'
      )
  LOOP
    -- A month that overlaps a freeze was priced by the freeze sync. Repricing it
    -- here would drop the lessons that fell outside the frozen days.
    IF public._bs_class_month_has_freeze(v_row.user_id, v_row.class_id, v_row.period) THEN
      CONTINUE;
    END IF;
    v_due := public._bs_class_month_due(v_row.user_id, v_row.class_id, v_row.period);
    IF v_due IS DISTINCT FROM v_row.amount_uzs THEN
      UPDATE public.ledger_entries
      SET voided_at = now(),
          voided_by = auth.uid(),
          void_reason = 'repriced'
      WHERE id = v_row.id
        AND voided_at IS NULL;
    END IF;
  END LOOP;

  FOR v_row IN
    SELECT m.user_id,
           m.class_id,
           min(COALESCE(m.activated_on, m.enrolled_on)) AS started_on
    FROM public.class_group_memberships m
    JOIN public.classes c ON c.id = m.class_id
    WHERE m.status <> 'left'
      AND c.archived_at IS NULL
      AND COALESCE(m.activated_on, m.enrolled_on) IS NOT NULL
      AND COALESCE(m.activated_on, m.enrolled_on) <= v_as_of
    GROUP BY m.user_id, m.class_id
  LOOP
    v_month := date_trunc('month', v_row.started_on)::date;
    WHILE v_month <= v_end LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.ledger_entries e
        WHERE e.user_id = v_row.user_id AND e.class_id = v_row.class_id
          AND e.group_id IS NULL AND e.kind = 'charge' AND e.period = v_month
          AND (
            e.voided_at IS NULL
            OR e.void_reason = 'payments reset'
          )
      ) THEN
        IF public._billing_charge_class_month(v_row.user_id, v_row.class_id, v_month, 'auto') IS NOT NULL THEN
          v_added := v_added + 1;
        END IF;
      END IF;
      v_month := (v_month + interval '1 month')::date;
    END LOOP;
  END LOOP;
  RETURN v_added;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261105000002', 'freeze_window')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
