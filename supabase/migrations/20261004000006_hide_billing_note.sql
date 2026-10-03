-- Teachers and editors can read students rows. The billing note stays admin-only
-- through admin_billing_note, which runs as the function owner.

REVOKE SELECT (billing_note) ON public.students FROM PUBLIC, anon, authenticated;
