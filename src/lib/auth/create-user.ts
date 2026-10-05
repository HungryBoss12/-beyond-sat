import { sessionAuthHeaders } from "./session-headers";

export type CreatedStudent = {
  userId: string;
  username: string;
  name: string;
};

function readableError(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "{}" || text === "[object Object]") return null;
    return text;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return (
      readableError(record.message) ??
      readableError(record.msg) ??
      readableError(record.error_description) ??
      readableError(record.details)
    );
  }
  return null;
}

export async function createClassStudent(input: {
  name: string;
  password: string;
  classId?: string | null;
  username?: string;
  mustChangeCredentials?: boolean;
}): Promise<CreatedStudent> {
  const headers = await sessionAuthHeaders();
  const res = await fetch("/api/admin/create-user", {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      if (!res.ok) {
        const snippet = text.trim().slice(0, 300);
        throw new Error(snippet && snippet !== "{}" ? snippet : `Could not create the account (${res.status}).`);
      }
      throw new Error("Could not create the account.");
    }
  }
  if (!res.ok) {
    throw new Error(
      readableError(body.error) ??
        readableError(body.message) ??
        readableError(body.msg) ??
        readableError(body.error_description) ??
        `Could not create the account (${res.status}).`,
    );
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const username = typeof body.username === "string" ? body.username : "";
  const name = typeof body.name === "string" ? body.name : "";
  if (!userId || !username) {
    throw new Error("Could not create the account (the server returned an empty result).");
  }
  return { userId, username, name };
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
