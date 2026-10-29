-- Support hours stay 15:00–19:00, and Sunday is not opened.

CREATE OR REPLACE FUNCTION public.support_prepare_windows(p_days integer DEFAULT 14)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher uuid;
  v_day date;
  v_end date;
  v_i integer;
  v_start timestamptz;
BEGIN
  IF auth.uid() IS NULL AND current_user NOT IN ('service_role', 'postgres') THEN
    RAISE EXCEPTION 'Sign in required' USING ERRCODE = '42501';
  END IF;
  v_day := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  v_end := v_day + GREATEST(1, LEAST(COALESCE(p_days, 14), 21));
  FOR v_teacher IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role::text = 'support_teacher'
  LOOP
    WHILE v_day < v_end LOOP
      IF EXTRACT(DOW FROM v_day) <> 0 THEN
        FOR v_i IN 0..7 LOOP
          v_start := ((v_day + time '15:00') AT TIME ZONE 'Asia/Tashkent') + make_interval(mins => v_i * 30);
          INSERT INTO public.support_windows (teacher_id, starts_at, ends_at)
          VALUES (v_teacher, v_start, v_start + interval '30 minutes')
          ON CONFLICT (teacher_id, starts_at) DO NOTHING;
        END LOOP;
      END IF;
      v_day := v_day + 1;
    END LOOP;
    v_day := (now() AT TIME ZONE 'Asia/Tashkent')::date;
  END LOOP;
END;
$$;

DELETE FROM public.support_windows
WHERE student_id IS NULL
  AND session_id IS NULL
  AND EXTRACT(DOW FROM (starts_at AT TIME ZONE 'Asia/Tashkent')) = 0;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261029000004', 'support_skip_sunday')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
