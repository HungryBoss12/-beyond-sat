-- Deleting a parent class, sub-class, lesson or user must cascade.
-- 1. The v1 parent-membership log wrote a 'left' event for a class that was being
--    deleted, which broke its own foreign key.
-- 2. The level-score guard refused cascade deletes and the lesson_id -> NULL update.
--    Direct deletes and edits stay blocked; only trigger-driven cascades pass.

CREATE OR REPLACE FUNCTION public.class_memberships_log_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
    VALUES (
      NEW.user_id,
      NEW.class_id,
      NEW.status,
      COALESCE(NEW.enrolled_on, public.bs_tashkent_today()),
      auth.uid()
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
      VALUES (NEW.user_id, NEW.class_id, NEW.status, public.bs_tashkent_today(), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF EXISTS (SELECT 1 FROM public.classes c WHERE c.id = OLD.class_id) THEN
      INSERT INTO public.class_membership_events (user_id, class_id, status, effective_on, changed_by)
      VALUES (OLD.user_id, OLD.class_id, 'left', public.bs_tashkent_today(), auth.uid());
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.student_level_scores_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_group_subject public.class_subject;
  v_section_subject public.class_subject;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Level scores cannot be deleted. Void them instead.';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF pg_trigger_depth() > 1
       AND OLD.lesson_id IS NOT NULL AND NEW.lesson_id IS NULL
       AND (to_jsonb(NEW) - 'lesson_id') = (to_jsonb(OLD) - 'lesson_id') THEN
      RETURN NEW;
    END IF;
    IF OLD.voided_at IS NOT NULL THEN
      RAISE EXCEPTION 'Voided scores cannot be changed';
    END IF;
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.group_id IS DISTINCT FROM OLD.group_id
       OR NEW.section_id IS DISTINCT FROM OLD.section_id
       OR NEW.score IS DISTINCT FROM OLD.score
       OR NEW.assessed_on IS DISTINCT FROM OLD.assessed_on
       OR NEW.lesson_id IS DISTINCT FROM OLD.lesson_id
       OR NEW.note IS DISTINCT FROM OLD.note
       OR NEW.created_by IS DISTINCT FROM OLD.created_by
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Level scores are append-only. Void and re-enter instead.';
    END IF;
    IF NEW.voided_at IS NOT NULL AND COALESCE(btrim(NEW.void_reason), '') = '' THEN
      RAISE EXCEPTION 'Void reason required';
    END IF;
    RETURN NEW;
  END IF;
  SELECT subject INTO v_group_subject FROM public.class_groups WHERE id = NEW.group_id;
  SELECT subject INTO v_section_subject FROM public.level_sections WHERE id = NEW.section_id;
  IF v_group_subject IS DISTINCT FROM v_section_subject THEN
    RAISE EXCEPTION 'That section belongs to the other subject';
  END IF;
  IF NOT public._bs_group_member(NEW.group_id, NEW.user_id) THEN
    RAISE EXCEPTION 'Student is not in this sub-class';
  END IF;
  IF NEW.assessed_on > public.bs_tashkent_today() THEN
    RAISE EXCEPTION 'Assessment date cannot be in the future';
  END IF;
  RETURN NEW;
END;
$$;
