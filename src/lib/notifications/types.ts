export type NotificationAudience = "class" | "all" | "users";

export type UserNotification = {
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
  read_at: string | null;
  dismissed_at: string | null;
};

export type CreateNotificationInput = {
  title: string;
  body?: string;
  imageUrl?: string;
  linkUrl?: string;
  linkLabel?: string;
  audienceType: NotificationAudience;
  classId?: string;
  userIds?: string[];
  displaySeconds?: number;
  sourceType?: "admin" | "vocab_homework";
  sourceId?: string;
};
