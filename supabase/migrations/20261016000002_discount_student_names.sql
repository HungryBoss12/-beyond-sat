-- Discount picker shows the student's name and surname.

CREATE OR REPLACE FUNCTION public.admin_discount_students()
RETURNS TABLE (
  user_id uuid,
  full_name text,
  class_id uuid,
  class_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.bs_is_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'teacher'
    )
  ) OR public.bs_is_self_banned() THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT DISTINCT m.user_id,
    COALESCE(NULLIF(btrim(concat_ws(' ', p.first_name, p.last_name)), ''), NULLIF(btrim(p.full_name), ''), 'Student'),
    c.id,
    c.name
  FROM public.class_memberships m
  JOIN public.profiles p ON p.id = m.user_id
  JOIN public.classes c ON c.id = m.class_id
  WHERE m.status <> 'left'
    AND (public.bs_is_admin() OR public.bs_teaches_student(m.user_id))
  ORDER BY 2, c.name;
END;
$$;

INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES ('20261016000002', 'discount_student_names')
ON CONFLICT (version) DO NOTHING;

NOTIFY pgrst, 'reload schema';
