export type ClassSubject = "math" | "ebrw";

export type ChatThreadKind = "subject_group" | "class_group" | "direct";

export type HomeworkSubmissionStatus =
  | "pending"
  | "submitted"
  | "reviewed"
  | "accepted"
  | "needs_revision";

export type ClassRow = {
  id: string;
  name: string;
  description: string | null;
  active: boolean;
  created_at: string;
};

export type ChatProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  telegram_username: string | null;
  telegram_connected_at: string | null;
  chat_setup_completed: boolean;
  class_id: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
};

export type ChatThread = {
  id: string;
  kind: ChatThreadKind;
  class_id: string | null;
  subject: ClassSubject | null;
  title: string;
  pinned: boolean;
  updated_at: string;
  created_at: string;
};

export type ChatMessage = {
  id: string;
  thread_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
};

export type ChatAttachment = {
  id: string;
  message_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
};

export type HomeworkAssignment = {
  id: string;
  class_id: string;
  subject: ClassSubject;
  title: string;
  body: string;
  due_at: string | null;
  created_at: string;
  created_by: string | null;
};

export type HomeworkFile = {
  id: string;
  assignment_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
};

export type HomeworkSubmission = {
  id: string;
  assignment_id: string;
  student_id: string;
  note: string;
  status: HomeworkSubmissionStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
};

export type LessonAttendance = {
  id: string;
  class_id: string;
  user_id: string;
  subject: ClassSubject | null;
  lesson_date: string;
  participated: boolean;
  note: string | null;
};

export type ChatMute = {
  id: string;
  user_id: string;
  thread_id: string | null;
  class_id: string | null;
  muted_by: string | null;
  reason: string | null;
  muted_until: string | null;
  created_at: string;
};

export const SUBJECT_LABEL: Record<ClassSubject, string> = {
  math: "Maths",
  ebrw: "EBRW",
};

export function displayName(p: Pick<ChatProfile, "username" | "full_name" | "first_name" | "email">) {
  return (
    p.username ||
    p.full_name ||
    p.first_name ||
    (p.email ? p.email.split("@")[0] : null) ||
    "Student"
  );
}

export function normalizeUsername(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 24);
}

export function isValidUsername(raw: string): boolean {
  return /^[a-z][a-z0-9_]{2,23}$/.test(normalizeUsername(raw));
}
