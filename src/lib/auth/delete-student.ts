import { sessionAuthHeaders } from "./session-headers";

function readableError(value: unknown): string | null {
  if (typeof value === "string") {
    const text = value.trim();
    if (!text || text === "{}" || text === "[object Object]") return null;
    return text;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return readableError(record.error) ?? readableError(record.message);
  }
  return null;
}

/** Removes a student login. Staff accounts are refused by the server. */
export async function deleteStudentAccount(userId: string): Promise<void> {
  const headers = await sessionAuthHeaders();
  const res = await fetch("/api/admin/delete-student", {
    method: "POST",
    headers,
    body: JSON.stringify({ userId }),
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
      if (!res.ok) throw new Error(text.trim().slice(0, 300) || "Could not delete the account.");
    }
  }
  if (!res.ok) {
    throw new Error(readableError(body.error) ?? "Could not delete the account.");
  }
}
