import { supabase } from "@/integrations/supabase/client";
import type { CreateNotificationInput, UserNotification } from "./types";
import type { StaffNotificationRow } from "./admin";

/** Inbox retention — notifications stay until the user deletes them. */
const INBOX_RETENTION_SECONDS = 365 * 24 * 3600;

type RecipientRow = {
  read_at: string | null;
  dismissed_at: string | null;
  user_notifications: {
    id: string;
    title: string;
    body: string | null;
    image_url: string | null;
    link_url: string | null;
    link_label: string | null;
    source_type: "admin" | "vocab_homework";
    source_id: string | null;
    created_at: string;
    expires_at: string;
    overlay_display_seconds: number;
  };
};

function mapRow(row: RecipientRow): UserNotification {
  const n = row.user_notifications;
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    image_url: n.image_url,
    link_url: n.link_url,
    link_label: n.link_label,
    source_type: n.source_type,
    source_id: n.source_id,
    created_at: n.created_at,
    expires_at: n.expires_at,
    overlay_display_seconds: n.overlay_display_seconds ?? 30,
    read_at: row.read_at,
    dismissed_at: row.dismissed_at,
  };
}

export async function fetchMyNotifications(): Promise<UserNotification[]> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from("user_notification_recipients")
    .select(
      "read_at,dismissed_at,user_notifications(id,title,body,image_url,link_url,link_label,source_type,source_id,created_at,expires_at,overlay_display_seconds)",
    )
    .eq("user_id", uid);

  if (error) throw new Error(error.message);
  const now = Date.now();
  return ((data ?? []) as RecipientRow[])
    .map(mapRow)
    .filter((n) => new Date(n.expires_at).getTime() > now)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function fetchDashboardNotifications(): Promise<UserNotification[]> {
  const rows = await fetchMyNotifications();
  return rows.filter((n) => !n.dismissed_at);
}

export async function markNotificationRead(notificationId: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("user_notification_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("notification_id", notificationId)
    .eq("user_id", uid)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** Hide a notification from the dashboard overlay; it remains in the inbox. */
export async function hideNotificationOverlay(notificationId: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("user_notification_recipients")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("notification_id", notificationId)
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
}

/** @deprecated Use hideNotificationOverlay for overlay close; deleteNotificationFromInbox for inbox. */
export async function dismissNotification(notificationId: string): Promise<void> {
  return hideNotificationOverlay(notificationId);
}

export async function deleteNotificationFromInbox(notificationId: string): Promise<void> {
  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;
  if (!uid) return;
  const { error } = await supabase
    .from("user_notification_recipients")
    .delete()
    .eq("notification_id", notificationId)
    .eq("user_id", uid);
  if (error) throw new Error(error.message);
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const overlaySeconds = Math.max(1, input.displaySeconds ?? 30);
  const expiresAt = new Date(Date.now() + INBOX_RETENTION_SECONDS * 1000).toISOString();

  const { data: sess } = await supabase.auth.getSession();
  const uid = sess.session?.user?.id;

  const { data: notif, error } = await supabase
    .from("user_notifications")
    .insert({
      title: input.title.trim(),
      body: input.body?.trim() || null,
      image_url: input.imageUrl || null,
      link_url: input.linkUrl || null,
      link_label: input.linkLabel || null,
      source_type: input.sourceType ?? "admin",
      source_id: input.sourceId ?? null,
      created_by: uid,
      audience_type: input.audienceType,
      class_id: input.classId ?? null,
      expires_at: expiresAt,
      overlay_display_seconds: overlaySeconds,
    })
    .select("id")
    .single();

  if (error || !notif) throw new Error(error?.message ?? "Could not create notification");

  const { error: fanErr } = await supabase.rpc("fan_out_notification", {
    p_notification_id: notif.id,
    p_audience_type: input.audienceType,
    p_class_id: input.classId ?? null,
    p_user_ids: input.userIds?.length ? input.userIds : null,
  });
  if (fanErr) throw new Error(fanErr.message);

  return notif.id;
}

export async function listStaffNotifications(limit = 25): Promise<StaffNotificationRow[]> {
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id,title,body,created_at,expires_at,overlay_display_seconds,audience_type")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as StaffNotificationRow[];
}

export function notificationRemainingMs(notification: UserNotification, now = Date.now()): number {
  return Math.max(0, new Date(notification.expires_at).getTime() - now);
}

export function notificationProgress(notification: UserNotification, now = Date.now()): number {
  const end = new Date(notification.expires_at).getTime();
  const start = new Date(notification.created_at).getTime();
  const total = end - start;
  if (total <= 0) return 0;
  const remaining = Math.max(0, end - now);
  return Math.min(1, Math.max(0, remaining / total));
}

export function overlayDisplayMs(notification: UserNotification): number {
  return Math.max(1, notification.overlay_display_seconds) * 1000;
}

export function overlayProgress(notification: UserNotification, now = Date.now()): number {
  const start = new Date(notification.created_at).getTime();
  const total = overlayDisplayMs(notification);
  const remaining = Math.max(0, total - (now - start));
  return remaining / total;
}

export function overlayExpired(notification: UserNotification, now = Date.now()): boolean {
  const start = new Date(notification.created_at).getTime();
  return now - start >= overlayDisplayMs(notification);
}

export const NOTIFICATIONS_CHANGED_EVENT = "beyond-sat:notifications-changed";
export const NOTIFICATION_LANDED_EVENT = "beyond-sat:notification-landed";

export function notifyNotificationsChanged() {
  window.dispatchEvent(new Event(NOTIFICATIONS_CHANGED_EVENT));
}

export function notifyNotificationLanded() {
  window.dispatchEvent(new Event(NOTIFICATION_LANDED_EVENT));
}
