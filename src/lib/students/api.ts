import { supabase } from "@/integrations/supabase/client";
import { sessionAuthHeaders } from "@/lib/auth/session-headers";

export type StudentRow = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string | null;
  parent_phone: string | null;
  grade: string | null;
  english_note: string | null;
  math_note: string | null;
  goal: string | null;
  claimed_at: string | null;
  username: string | null;
  class_id: string | null;
  class_name: string | null;
  /** Every parent class. Empty when the student is not in a class. */
  class_ids?: string[] | null;
};

export async function listStudents(search = ""): Promise<StudentRow[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("staff_list_students", { p_search: search });
  if (error) throw error;
  return (data ?? []) as StudentRow[];
}

export async function unclaimedUserIds(userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("students")
    .select("user_id, claimed_at")
    .in("user_id", userIds);
  if (error) throw error;
  const ids = new Set<string>();
  for (const row of (data ?? []) as { user_id: string | null; claimed_at: string | null }[]) {
    if (row.user_id && !row.claimed_at) ids.add(row.user_id);
  }
  return ids;
}

export type InviteLink = {
  studentId: string;
  username: string;
  name: string;
  url: string;
};

async function postInvite(body: Record<string, unknown>): Promise<InviteLink> {
  const headers = await sessionAuthHeaders();
  const res = await fetch("/api/admin/student-invite", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const payload = (await res.json()) as {
    error?: string;
    studentId?: string;
    username?: string;
    name?: string;
    path?: string;
  };
  if (!res.ok || !payload.path) throw new Error(payload.error ?? "Could not create the link.");
  return {
    studentId: payload.studentId ?? "",
    username: payload.username ?? "",
    name: payload.name ?? "",
    url: `${window.location.origin}${payload.path}`,
  };
}

export function createStudentInvite(input: { name: string; classId?: string }): Promise<InviteLink> {
  return postInvite({ name: input.name, classId: input.classId ?? null });
}

export function reissueStudentInvite(userId: string): Promise<InviteLink> {
  return postInvite({ userId });
}

export async function previewInvite(token: string): Promise<{ name: string; username: string }> {
  const res = await fetch("/api/auth/preview-invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
  const body = (await res.json()) as { error?: string; name?: string; username?: string };
  if (!res.ok) throw new Error(body.error ?? "This link is not valid.");
  return { name: body.name ?? "", username: body.username ?? "" };
}

export async function claimInvite(input: {
  token: string;
  name: string;
  username: string;
  password: string;
}): Promise<{ username: string }> {
  const res = await fetch("/api/auth/claim-invite", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as { error?: string; username?: string };
  if (!res.ok || !body.username) throw new Error(body.error ?? "Could not save your account.");
  return { username: body.username };
}
