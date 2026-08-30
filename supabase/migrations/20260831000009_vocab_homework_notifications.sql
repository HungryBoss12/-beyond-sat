-- Vocab homework assignments + dashboard notifications.

DO $$ BEGIN
  CREATE TYPE public.vocab_homework_target AS ENUM ('deck', 'quiz');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vocab_homework_recurrence AS ENUM ('once', 'daily', 'weekly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_audience AS ENUM ('class', 'all', 'users');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.vocab_homework_status AS ENUM ('in_progress', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_source AS ENUM ('admin', 'vocab_homework');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------
-- Vocab homework
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.vocab_homework_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  instructions text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  target_type public.vocab_homework_target NOT NULL,
  deck_id uuid REFERENCES public.vocab_decks(id) ON DELETE SET NULL,
  quiz_id uuid REFERENCES public.vocab_quizzes(id) ON DELETE SET NULL,
  card_target integer CHECK (card_target IS NULL OR card_target > 0),
  require_green_only boolean NOT NULL DEFAULT true,
  recurrence public.vocab_homework_recurrence NOT NULL DEFAULT 'once',
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz,
  due_at timestamptz,
  audience_type public.notification_audience NOT NULL DEFAULT 'all',
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  display_hours integer NOT NULL DEFAULT 168 CHECK (display_hours > 0),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vocab_homework_target_check CHECK (
    (target_type = 'deck' AND deck_id IS NOT NULL AND quiz_id IS NULL AND card_target IS NOT NULL)
    OR (target_type = 'quiz' AND quiz_id IS NOT NULL AND deck_id IS NULL)
  ),
  CONSTRAINT vocab_homework_audience_check CHECK (
    (audience_type = 'class' AND class_id IS NOT NULL)
    OR (audience_type = 'all' AND class_id IS NULL)
    OR (audience_type = 'users')
  )
);

CREATE INDEX IF NOT EXISTS vocab_homework_assignments_active_idx
  ON public.vocab_homework_assignments (active, starts_at DESC);

DROP TRIGGER IF EXISTS vocab_homework_assignments_set_updated_at ON public.vocab_homework_assignments;
CREATE TRIGGER vocab_homework_assignments_set_updated_at
  BEFORE UPDATE ON public.vocab_homework_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.vocab_homework_assignment_users (
  assignment_id uuid NOT NULL REFERENCES public.vocab_homework_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  PRIMARY KEY (assignment_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.vocab_homework_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.vocab_homework_assignments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  cards_reviewed integer NOT NULL DEFAULT 0,
  green_reviews integer NOT NULL DEFAULT 0,
  quiz_score integer,
  quiz_total integer,
  status public.vocab_homework_status NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (assignment_id, user_id, period_key)
);

CREATE INDEX IF NOT EXISTS vocab_homework_completions_user_idx
  ON public.vocab_homework_completions (user_id, assignment_id);

DROP TRIGGER IF EXISTS vocab_homework_completions_set_updated_at ON public.vocab_homework_completions;
CREATE TRIGGER vocab_homework_completions_set_updated_at
  BEFORE UPDATE ON public.vocab_homework_completions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  image_url text,
  link_url text,
  link_label text,
  source_type public.notification_source NOT NULL DEFAULT 'admin',
  source_id uuid,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  audience_type public.notification_audience NOT NULL DEFAULT 'all',
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS user_notifications_expires_idx
  ON public.user_notifications (expires_at DESC);

CREATE TABLE IF NOT EXISTS public.user_notification_recipients (
  notification_id uuid NOT NULL REFERENCES public.user_notifications(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS user_notification_recipients_user_idx
  ON public.user_notification_recipients (user_id, dismissed_at);

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_notification_recipients(
  p_audience_type public.notification_audience,
  p_class_id uuid DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL
)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT uid FROM (
    SELECT auth.uid() AS uid WHERE false
    UNION ALL
    SELECT cm.user_id
    FROM public.class_memberships cm
    WHERE p_audience_type = 'class' AND cm.class_id = p_class_id
    UNION ALL
    SELECT p.id
    FROM public.profiles p
    WHERE p_audience_type = 'all'
    UNION ALL
    SELECT unnest(p_user_ids)
    WHERE p_audience_type = 'users' AND p_user_ids IS NOT NULL
  ) s
  WHERE uid IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_notification_recipients(public.notification_audience, uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.fan_out_notification(
  p_notification_id uuid,
  p_audience_type public.notification_audience,
  p_class_id uuid DEFAULT NULL,
  p_user_ids uuid[] DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inserted integer;
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'staff only';
  END IF;

  INSERT INTO public.user_notification_recipients (notification_id, user_id)
  SELECT p_notification_id, r.uid
  FROM public.resolve_notification_recipients(p_audience_type, p_class_id, p_user_ids) AS r(uid)
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN inserted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.fan_out_notification(uuid, public.notification_audience, uuid, uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.vocab_homework_period_key(
  p_recurrence public.vocab_homework_recurrence,
  p_at timestamptz DEFAULT now()
)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_recurrence
    WHEN 'once' THEN 'once'
    WHEN 'daily' THEN to_char(p_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
    WHEN 'weekly' THEN to_char(p_at AT TIME ZONE 'UTC', 'IYYY-"W"IW')
  END;
$$;

GRANT EXECUTE ON FUNCTION public.vocab_homework_period_key(public.vocab_homework_recurrence, timestamptz) TO authenticated;

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.vocab_homework_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_homework_assignment_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vocab_homework_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notification_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vocab_homework_assignments read"
  ON public.vocab_homework_assignments FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR (
      active
      AND starts_at <= now()
      AND (ends_at IS NULL OR ends_at >= now())
      AND (
        audience_type = 'all'
        OR (audience_type = 'class' AND public.bs_is_class_member(class_id))
        OR (
          audience_type = 'users'
          AND EXISTS (
            SELECT 1 FROM public.vocab_homework_assignment_users ahu
            WHERE ahu.assignment_id = id AND ahu.user_id = auth.uid()
          )
        )
      )
    )
  );

CREATE POLICY "vocab_homework_assignments staff write"
  ON public.vocab_homework_assignments FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "vocab_homework_assignment_users read"
  ON public.vocab_homework_assignment_users FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.vocab_homework_assignments a
      WHERE a.id = assignment_id AND public.bs_is_staff()
    )
  );

CREATE POLICY "vocab_homework_assignment_users staff write"
  ON public.vocab_homework_assignment_users FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "vocab_homework_completions own read"
  ON public.vocab_homework_completions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

CREATE POLICY "vocab_homework_completions own write"
  ON public.vocab_homework_completions FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff())
  WITH CHECK (user_id = auth.uid() OR public.bs_is_staff());

CREATE POLICY "user_notifications read"
  ON public.user_notifications FOR SELECT TO authenticated
  USING (
    public.bs_is_staff()
    OR EXISTS (
      SELECT 1 FROM public.user_notification_recipients r
      WHERE r.notification_id = id AND r.user_id = auth.uid()
    )
  );

CREATE POLICY "user_notifications staff write"
  ON public.user_notifications FOR ALL TO authenticated
  USING (public.bs_is_staff())
  WITH CHECK (public.bs_is_staff());

CREATE POLICY "user_notification_recipients own read"
  ON public.user_notification_recipients FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.bs_is_staff());

CREATE POLICY "user_notification_recipients own update"
  ON public.user_notification_recipients FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_notification_recipients staff insert"
  ON public.user_notification_recipients FOR INSERT TO authenticated
  WITH CHECK (public.bs_is_staff());
