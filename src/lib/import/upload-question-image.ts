import { supabase } from "@/integrations/supabase/client";

const UPLOAD_TIMEOUT_MS = 45_000;
const REFRESH_SKEW_SECONDS = 120;

function supabasePublicConfig(): { url: string; anonKey: string } {
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase is not configured, so images cannot be uploaded.");
  }
  return { url: url.replace(/\/$/, ""), anonKey };
}

function extensionFor(file: File | Blob, filename?: string): { ext: string; contentType: string } {
  const name = (filename || (file instanceof File ? file.name : "")).toLowerCase();
  const type = (file.type || "").toLowerCase();
  if (type === "image/png" || name.endsWith(".png")) return { ext: "png", contentType: "image/png" };
  if (type === "image/webp" || name.endsWith(".webp"))
    return { ext: "webp", contentType: "image/webp" };
  if (type === "image/gif" || name.endsWith(".gif")) return { ext: "gif", contentType: "image/gif" };
  if (type === "image/jpeg" || type === "image/jpg" || /\.jpe?g$/.test(name)) {
    return { ext: "jpg", contentType: "image/jpeg" };
  }
  return { ext: "jpg", contentType: type.startsWith("image/") ? type : "image/jpeg" };
}

function mapStorageError(message: string): Error {
  const lower = message.toLowerCase();
  if (
    lower.includes("row-level security") ||
    lower.includes("unauthorized") ||
    lower.includes("not allowed") ||
    lower.includes("403")
  ) {
    return new Error("Upload blocked — sign in with an admin or editor account and try again.");
  }
  if (lower.includes("jwt") || lower.includes("session") || lower.includes("401")) {
    return new Error("Your session expired. Refresh the page, sign in again, and retry the upload.");
  }
  return new Error(message || "That image could not be uploaded.");
}

function parseStorageErrorBody(text: string): string {
  try {
    const parsed = JSON.parse(text) as { message?: unknown; error?: unknown; statusCode?: unknown };
    if (typeof parsed.message === "string" && parsed.message.trim()) return parsed.message;
    if (typeof parsed.error === "string" && parsed.error.trim()) return parsed.error;
  } catch {
    /* body is not JSON */
  }
  return text.trim();
}

async function accessTokenForUpload(): Promise<string> {
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr) throw mapStorageError(userErr.message);
  if (!userData.user) throw new Error("Sign in to upload images.");

  const { data: sessData } = await supabase.auth.getSession();
  let session = sessData.session;
  const expiresAt = session?.expires_at ?? 0;
  if (!session?.access_token || expiresAt - Date.now() / 1000 < REFRESH_SKEW_SECONDS) {
    const { data: refreshed, error: refreshErr } = await supabase.auth.refreshSession();
    if (refreshErr) throw mapStorageError(refreshErr.message);
    session = refreshed.session;
  }
  if (!session?.access_token) throw new Error("Sign in to upload images.");
  return session.access_token;
}

/**
 * Upload a figure to the private `question-images` bucket and return the
 * object path (not a signed URL). Callers persist the path and sign on display.
 *
 * Uses a raw Storage REST POST with an ArrayBuffer body. The SDK wraps File
 * uploads in FormData while the client still sends `Content-Type: application/json`,
 * which makes Chromium hang until our UI timeout fires with no image saved.
 */
export async function uploadQuestionImage(file: File | Blob, filename?: string): Promise<string> {
  const { url, anonKey } = supabasePublicConfig();
  const token = await accessTokenForUpload();

  const { ext, contentType } = extensionFor(file, filename);
  const path = `${crypto.randomUUID()}.${ext}`;
  const bytes = await file.arrayBuffer();

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const uploadRes = await fetch(`${url}/storage/v1/object/question-images/${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: anonKey,
        "Content-Type": contentType,
        "x-upsert": "false",
      },
      body: bytes,
      signal: controller.signal,
    });
    if (!uploadRes.ok) {
      const detail = parseStorageErrorBody(await uploadRes.text().catch(() => ""));
      throw mapStorageError(detail || `Upload failed (${uploadRes.status}).`);
    }
    return path;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Image upload timed out. Try a smaller PNG or JPEG.");
    }
    throw err instanceof Error ? err : new Error(String(err));
  } finally {
    window.clearTimeout(timer);
  }
}
