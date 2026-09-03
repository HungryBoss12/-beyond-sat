-- Staff can update/delete notifications they manage; tests get a publish flag.

GRANT INSERT, UPDATE, DELETE ON public.user_notifications TO authenticated;
GRANT DELETE ON public.user_notification_recipients TO authenticated;

ALTER TABLE public.tests
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.tests.published IS
  'When false, the test is hidden from Practice browse but still editable in Admin.';
