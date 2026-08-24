import { supabase } from "@/integrations/supabase/client";
import type {
  ChatAttachment,
  ChatMessage,
  ChatProfile,
  ChatThread,
  ClassRow,
  ClassSubject,
  HomeworkAssignment,
  HomeworkFile,
  HomeworkSubmission,
  HomeworkSubmissionStatus,
  LessonAttendance,
} from "./types";
import { normalizeUsername } from "./types";

/** Loose casts — Classes tables ship ahead of regenerated supabase types. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

const db = supabase as unknown as AnyClient;

export async function listActiveClasses(): Promise<ClassRow[]> {
  const { data, error } = await db
    .from("classes")
    .select("id,name,description,active,created_at")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function listAllClasses(): Promise<ClassRow[]> {
  const { data, error } = await db
    .from("classes")
    .select("id,name,description,active,created_at")
    .order("name");
  if (error) throw error;
  return (data ?? []) as ClassRow[];
}

export async function createClass(input: {
  name: string;
  description?: string | null;
}): Promise<ClassRow> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("classes")
    .insert({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      created_by: u.user?.id ?? null,
    })
    .select("id,name,description,active,created_at")
    .single();
  if (error) throw error;
  return data as ClassRow;
}

export async function updateClass(
  id: string,
  patch: Partial<Pick<ClassRow, "name" | "description" | "active">>,
): Promise<void> {
  const next = { ...patch };
  if (typeof next.name === "string") next.name = next.name.trim();
  if (typeof next.description === "string") next.description = next.description.trim() || null;
  if (next.name === "") throw new Error("Group name cannot be empty.");
  const { error } = await db.from("classes").update(next).eq("id", id);
  if (error) throw error;
  if (next.name) {
    const { error: tErr } = await db
      .from("chat_threads")
      .update({ title: `${next.name} · Class` })
      .eq("class_id", id)
      .eq("kind", "class_group");
    if (tErr) throw tErr;
  }
}

export async function deleteClass(id: string): Promise<void> {
  const { error } = await db.from("classes").delete().eq("id", id);
  if (error) throw error;
}

export async function joinClass(classId: string): Promise<void> {
  const { error } = await db.rpc("join_class", { p_class_id: classId });
  if (error) throw error;
}

export async function listClassMembers(classId: string): Promise<{ user_id: string; joined_at: string }[]> {
  const { data, error } = await db
    .from("class_memberships")
    .select("user_id,joined_at")
    .eq("class_id", classId)
    .order("joined_at");
  if (error) throw error;
  return (data ?? []) as { user_id: string; joined_at: string }[];
}

export async function getChatProfile(userId?: string): Promise<ChatProfile | null> {
  let uid = userId;
  if (!uid) {
    const { data } = await supabase.auth.getUser();
    uid = data.user?.id;
  }
  if (!uid) return null;
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,username,avatar_url,telegram_username,telegram_connected_at,chat_setup_completed,class_id,full_name,first_name,last_name,email",
    )
    .eq("id", uid)
    .maybeSingle();
  if (error) throw error;
  return (data as ChatProfile) ?? null;
}

export async function saveChatSetup(input: {
  username: string;
  avatar_url?: string | null;
  telegram_username?: string | null;
  class_id: string;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const username = normalizeUsername(input.username);
  await joinClass(input.class_id);
  const { error: pErr } = await db
    .from("profiles")
    .update({
      username,
      avatar_url: input.avatar_url ?? null,
      telegram_username: input.telegram_username?.replace(/^@/, "").trim() || null,
      chat_setup_completed: true,
      class_id: input.class_id,
    })
    .eq("id", u.user.id);
  if (pErr) throw pErr;
}

export async function searchUsersByUsername(q: string, limit = 20): Promise<ChatProfile[]> {
  const needle = normalizeUsername(q);
  if (needle.length < 2) return [];
  const { data, error } = await db
    .from("profiles")
    .select(
      "id,username,avatar_url,telegram_username,telegram_connected_at,chat_setup_completed,class_id,full_name,first_name,last_name,email",
    )
    .ilike("username", `${needle}%`)
    .eq("chat_setup_completed", true)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChatProfile[];
}

export async function listMyThreads(): Promise<ChatThread[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data: memberships, error: mErr } = await db
    .from("chat_thread_members")
    .select("thread_id")
    .eq("user_id", u.user.id);
  if (mErr) throw mErr;
  const ids = ((memberships ?? []) as { thread_id: string }[]).map((m) => m.thread_id);
  if (ids.length === 0) return [];
  const { data, error } = await db
    .from("chat_threads")
    .select("id,kind,class_id,subject,title,pinned,updated_at,created_at")
    .in("id", ids)
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as ChatThread[];
  // Subject groups first (Maths, EBRW), then class group, then directs
  return rows.sort((a, b) => {
    const rank = (t: ChatThread) => {
      if (t.kind === "subject_group" && t.subject === "math") return 0;
      if (t.kind === "subject_group" && t.subject === "ebrw") return 1;
      if (t.kind === "class_group") return 2;
      return 3;
    };
    const d = rank(a) - rank(b);
    if (d !== 0) return d;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export async function listThreadMessages(
  threadId: string,
  limit = 80,
): Promise<{ messages: ChatMessage[]; attachments: ChatAttachment[] }> {
  const { data, error } = await db
    .from("chat_messages")
    .select("id,thread_id,sender_id,body,created_at,edited_at,deleted_at")
    .eq("thread_id", threadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const messages = (data ?? []) as ChatMessage[];
  const ids = messages.map((m) => m.id);
  if (ids.length === 0) return { messages, attachments: [] };
  const { data: atts, error: aErr } = await db
    .from("chat_message_attachments")
    .select("id,message_id,storage_path,file_name,mime_type,byte_size")
    .in("message_id", ids);
  if (aErr) throw aErr;
  return { messages, attachments: (atts ?? []) as ChatAttachment[] };
}

export async function sendMessage(
  threadId: string,
  body: string,
  attachments?: { storage_path: string; file_name: string; mime_type?: string | null; byte_size?: number | null }[],
): Promise<ChatMessage> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const { data, error } = await db
    .from("chat_messages")
    .insert({ thread_id: threadId, sender_id: u.user.id, body: body.trim() })
    .select("id,thread_id,sender_id,body,created_at,edited_at,deleted_at")
    .single();
  if (error) throw error;
  const msg = data as ChatMessage;
  if (attachments && attachments.length > 0) {
    const { error: aErr } = await db.from("chat_message_attachments").insert(
      attachments.map((a) => ({
        message_id: msg.id,
        storage_path: a.storage_path,
        file_name: a.file_name,
        mime_type: a.mime_type ?? null,
        byte_size: a.byte_size ?? null,
      })),
    );
    if (aErr) throw aErr;
  }
  return msg;
}

export async function openDirectThread(otherUserId: string): Promise<string> {
  const { data, error } = await db.rpc("open_direct_thread", { p_other_user_id: otherUserId });
  if (error) throw error;
  return data as string;
}

export async function getDirectPeerProfiles(threadIds: string[]): Promise<Map<string, ChatProfile>> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user || threadIds.length === 0) return new Map();
  const { data: members, error } = await db
    .from("chat_thread_members")
    .select("thread_id,user_id")
    .in("thread_id", threadIds);
  if (error) throw error;
  const peerIds = new Set<string>();
  const threadPeer = new Map<string, string>();
  for (const m of (members ?? []) as { thread_id: string; user_id: string }[]) {
    if (m.user_id === u.user.id) continue;
    peerIds.add(m.user_id);
    threadPeer.set(m.thread_id, m.user_id);
  }
  if (peerIds.size === 0) return new Map();
  const { data: profiles, error: pErr } = await db
    .from("profiles")
    .select(
      "id,username,avatar_url,telegram_username,telegram_connected_at,chat_setup_completed,class_id,full_name,first_name,last_name,email",
    )
    .in("id", [...peerIds]);
  if (pErr) throw pErr;
  const byId = new Map(((profiles ?? []) as ChatProfile[]).map((p) => [p.id, p]));
  const out = new Map<string, ChatProfile>();
  for (const [tid, uid] of threadPeer) {
    const p = byId.get(uid);
    if (p) out.set(tid, p);
  }
  return out;
}

export async function listHomework(classId: string, subject?: ClassSubject): Promise<HomeworkAssignment[]> {
  let q = db
    .from("homework_assignments")
    .select("id,class_id,subject,title,body,due_at,created_at,created_by")
    .eq("class_id", classId)
    .order("created_at", { ascending: false });
  if (subject) q = q.eq("subject", subject);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as HomeworkAssignment[];
}

export async function createHomework(input: {
  class_id: string;
  subject: ClassSubject;
  title: string;
  body: string;
  due_at?: string | null;
}): Promise<HomeworkAssignment> {
  const { data: u } = await supabase.auth.getUser();
  const { data, error } = await db
    .from("homework_assignments")
    .insert({
      class_id: input.class_id,
      subject: input.subject,
      title: input.title.trim(),
      body: input.body.trim(),
      due_at: input.due_at || null,
      created_by: u.user?.id ?? null,
    })
    .select("id,class_id,subject,title,body,due_at,created_at,created_by")
    .single();
  if (error) throw error;
  return data as HomeworkAssignment;
}

export async function listHomeworkFiles(assignmentIds: string[]): Promise<HomeworkFile[]> {
  if (assignmentIds.length === 0) return [];
  const { data, error } = await db
    .from("homework_files")
    .select("id,assignment_id,storage_path,file_name,mime_type,byte_size")
    .in("assignment_id", assignmentIds);
  if (error) throw error;
  return (data ?? []) as HomeworkFile[];
}

export async function addHomeworkFiles(
  assignmentId: string,
  files: { storage_path: string; file_name: string; mime_type?: string | null; byte_size?: number | null }[],
): Promise<void> {
  if (files.length === 0) return;
  const { error } = await db.from("homework_files").insert(
    files.map((f) => ({
      assignment_id: assignmentId,
      storage_path: f.storage_path,
      file_name: f.file_name,
      mime_type: f.mime_type ?? null,
      byte_size: f.byte_size ?? null,
    })),
  );
  if (error) throw error;
}

export async function getMySubmission(assignmentId: string): Promise<HomeworkSubmission | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await db
    .from("homework_submissions")
    .select("id,assignment_id,student_id,note,status,reviewed_by,reviewed_at,review_note,created_at")
    .eq("assignment_id", assignmentId)
    .eq("student_id", u.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data as HomeworkSubmission) ?? null;
}

export async function upsertSubmission(input: {
  assignment_id: string;
  note: string;
}): Promise<HomeworkSubmission> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const existing = await getMySubmission(input.assignment_id);
  const status: HomeworkSubmissionStatus =
    existing?.status === "accepted" || existing?.status === "reviewed"
      ? existing.status
      : "submitted";
  const { data, error } = await db
    .from("homework_submissions")
    .upsert(
      {
        assignment_id: input.assignment_id,
        student_id: u.user.id,
        note: input.note.trim(),
        status,
      },
      { onConflict: "assignment_id,student_id" },
    )
    .select("id,assignment_id,student_id,note,status,reviewed_by,reviewed_at,review_note,created_at")
    .single();
  if (error) throw error;
  return data as HomeworkSubmission;
}

export async function addSubmissionFiles(
  submissionId: string,
  files: { storage_path: string; file_name: string; mime_type?: string | null; byte_size?: number | null }[],
): Promise<void> {
  if (files.length === 0) return;
  const { error } = await db.from("homework_submission_files").insert(
    files.map((f) => ({
      submission_id: submissionId,
      storage_path: f.storage_path,
      file_name: f.file_name,
      mime_type: f.mime_type ?? null,
      byte_size: f.byte_size ?? null,
    })),
  );
  if (error) throw error;
}

export async function listSubmissionsForAssignment(assignmentId: string): Promise<HomeworkSubmission[]> {
  const { data, error } = await db
    .from("homework_submissions")
    .select("id,assignment_id,student_id,note,status,reviewed_by,reviewed_at,review_note,created_at")
    .eq("assignment_id", assignmentId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as HomeworkSubmission[];
}

export async function reviewSubmission(
  id: string,
  status: HomeworkSubmissionStatus,
  review_note?: string | null,
): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const { error } = await db
    .from("homework_submissions")
    .update({
      status,
      review_note: review_note ?? null,
      reviewed_by: u.user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw error;
}

export async function listClassAttendanceOnDate(
  classId: string,
  lessonDate: string,
  subject?: ClassSubject | null,
): Promise<LessonAttendance[]> {
  let q = db
    .from("lesson_attendance")
    .select("id,class_id,user_id,subject,lesson_date,participated,note")
    .eq("class_id", classId)
    .eq("lesson_date", lessonDate);
  q = subject ? q.eq("subject", subject) : q.is("subject", null);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as LessonAttendance[];
}

export async function listAttendance(userId: string, days = 370): Promise<LessonAttendance[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const ymd = since.toISOString().slice(0, 10);
  const { data, error } = await db
    .from("lesson_attendance")
    .select("id,class_id,user_id,subject,lesson_date,participated,note")
    .eq("user_id", userId)
    .gte("lesson_date", ymd)
    .order("lesson_date", { ascending: true });
  if (error) throw error;
  return (data ?? []) as LessonAttendance[];
}

export async function markAttendance(input: {
  class_id: string;
  user_id: string;
  lesson_date: string;
  subject?: ClassSubject | null;
  participated?: boolean;
  note?: string | null;
}): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const subject = input.subject ?? null;
  // Partial unique with NULL subject is awkward in Postgres; delete then insert.
  let del = db
    .from("lesson_attendance")
    .delete()
    .eq("class_id", input.class_id)
    .eq("user_id", input.user_id)
    .eq("lesson_date", input.lesson_date);
  del = subject == null ? del.is("subject", null) : del.eq("subject", subject);
  const { error: dErr } = await del;
  if (dErr) throw dErr;
  const { error } = await db.from("lesson_attendance").insert({
    class_id: input.class_id,
    user_id: input.user_id,
    lesson_date: input.lesson_date,
    subject,
    participated: input.participated ?? true,
    note: input.note ?? null,
    marked_by: u.user?.id ?? null,
  });
  if (error) throw error;
}

export async function signedUrl(bucket: "chat-uploads" | "homework-uploads", path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}
