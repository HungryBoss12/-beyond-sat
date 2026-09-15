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
  username?: string;
  mustChangeCredentials?: boolean;
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

/** Random password suitable for handoff (12 chars, mixed). */
export function generateStudentPassword(length = 12): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$";
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i]! % alphabet.length];
  return out;
}
