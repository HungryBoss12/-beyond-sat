import { sessionAuthHeaders } from "./session-headers";

export type CreatedStudent = {
  userId: string;
  username: string;
  name: string;
};

export async function createClassStudent(input: {
  name: string;
  password: string;
  classId: string;
}): Promise<CreatedStudent> {
  const headers = await sessionAuthHeaders();
  const res = await fetch("/api/admin/create-user", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const body = (await res.json()) as CreatedStudent & { error?: string };
  if (!res.ok) throw new Error(body.error ?? "Could not create account.");
  return { userId: body.userId, username: body.username, name: body.name };
}
