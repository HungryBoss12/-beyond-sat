-- Allow students to permanently remove notifications from their inbox.

CREATE POLICY "user_notification_recipients own delete"
  ON public.user_notification_recipients FOR DELETE TO authenticated
  USING (user_id = auth.uid());

GRANT DELETE ON public.user_notification_recipients TO authenticated;
