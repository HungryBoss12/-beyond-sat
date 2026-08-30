import type { NotificationAudience } from "./types";

export function validateNotificationAudience(
  audienceType: NotificationAudience,
  classId: string,
  selectedUsers: string[],
): string | null {
  if (audienceType === "class" && !classId) return "Choose a class.";
  if (audienceType === "users" && selectedUsers.length === 0) return "Pick at least one student.";
  return null;
}

export type StaffNotificationRow = {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  expires_at: string;
  overlay_display_seconds: number;
  audience_type: NotificationAudience;
};
