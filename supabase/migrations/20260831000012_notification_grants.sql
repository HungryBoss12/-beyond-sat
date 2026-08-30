-- Notification tables were created with RLS but without table-level grants for
-- the authenticated role, which blocked dismiss (UPDATE dismissed_at).

GRANT SELECT ON public.user_notifications TO authenticated;
GRANT SELECT, UPDATE ON public.user_notification_recipients TO authenticated;
