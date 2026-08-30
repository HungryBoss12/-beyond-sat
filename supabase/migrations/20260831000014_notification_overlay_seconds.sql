-- Overlay visibility duration (admin-configured) separate from inbox expiry.

ALTER TABLE public.user_notifications
  ADD COLUMN IF NOT EXISTS overlay_display_seconds integer NOT NULL DEFAULT 30
  CHECK (overlay_display_seconds > 0);

COMMENT ON COLUMN public.user_notifications.overlay_display_seconds IS
  'Seconds the notification stays on the dashboard overlay before moving to the inbox.';

-- Backfill: derive from legacy expires_at window when possible.
UPDATE public.user_notifications
SET overlay_display_seconds = LEAST(
  GREATEST(EXTRACT(EPOCH FROM (expires_at - created_at))::integer, 30),
  86400
)
WHERE overlay_display_seconds = 30;
