import { supabase } from "@/integrations/supabase/client";
import type { CreateNotificationInput, UserNotification } from "./types";

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
      "read_at,dismissed_at,user_notifications(id,title,body,image_url,link_url,link_label,source_type,source_id,created_at,expires_at)",
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

export async function dismissNotification(notificationId: string): Promise<void> {
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

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const displaySeconds = input.displaySeconds ?? 604800;
  const expiresAt = new Date(Date.now() + displaySeconds * 1000).toISOString();

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
