-- Drop the v1 leftovers now that every reader uses sub-classes.
-- classes.math_* / ebrw_* were copied onto class_groups in 20261001000001.
-- lesson_var_marks is the read-only view over lesson_hw_marks from 20261001000004.
-- ensure_class_lessons and set_attendance were rewritten in 20261001000001 and no
-- longer read these columns.

DROP VIEW IF EXISTS public.lesson_var_marks;

ALTER TABLE public.classes
  DROP COLUMN IF EXISTS math_schedule_days,
  DROP COLUMN IF EXISTS math_start_time,
  DROP COLUMN IF EXISTS math_end_time,
  DROP COLUMN IF EXISTS ebrw_schedule_days,
  DROP COLUMN IF EXISTS ebrw_start_time,
  DROP COLUMN IF EXISTS ebrw_end_time;
