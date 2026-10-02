-- Students are roster people (name and basic info). A user is a registered
-- account. A student may have a provisional account before they claim it.

CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL CHECK (btrim(full_name) <> ''),
  phone text,
  parent_phone text,
  grade text,
  english_note text,
  math_note text,
  goal text,
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at timestamptz,
  import_key text UNIQUE,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.students.claimed_at IS 'Null until the student finishes the one-time setup link.';
COMMENT ON COLUMN public.students.import_key IS 'Stable key for the spreadsheet import. Null for students created by hand.';

CREATE TABLE IF NOT EXISTS public.student_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS student_invites_one_live
  ON public.student_invites (student_id)
  WHERE used_at IS NULL;

ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "students staff read" ON public.students;
CREATE POLICY "students staff read" ON public.students
  FOR SELECT TO authenticated
  USING (public.bs_is_staff());

GRANT SELECT ON public.students TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.students FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.students TO service_role;

REVOKE ALL ON public.student_invites FROM authenticated, anon, PUBLIC;
GRANT ALL ON public.student_invites TO service_role;

CREATE OR REPLACE FUNCTION public.staff_list_students(p_search text DEFAULT '')
RETURNS TABLE (
  id uuid,
  user_id uuid,
  full_name text,
  phone text,
  parent_phone text,
  grade text,
  english_note text,
  math_note text,
  goal text,
  claimed_at timestamptz,
  username text,
  class_id uuid,
  class_name text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search text := btrim(COALESCE(p_search, ''));
BEGIN
  IF NOT public.bs_is_staff() THEN
    RAISE EXCEPTION 'Staff access required';
  END IF;
  RETURN QUERY
  SELECT
    s.id,
    s.user_id,
    s.full_name,
    s.phone,
    s.parent_phone,
    s.grade,
    s.english_note,
    s.math_note,
    s.goal,
    s.claimed_at,
    p.username,
    m.class_id,
    c.name
  FROM public.students s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  LEFT JOIN public.class_memberships m ON m.user_id = s.user_id
  LEFT JOIN public.classes c ON c.id = m.class_id
  WHERE v_search = ''
     OR s.full_name ILIKE '%' || v_search || '%'
     OR COALESCE(s.phone, '') ILIKE '%' || v_search || '%'
     OR COALESCE(p.username, '') ILIKE v_search || '%'
  ORDER BY s.full_name
  LIMIT 400;
END;
$$;

REVOKE ALL ON FUNCTION public.staff_list_students(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_list_students(text) TO authenticated;
