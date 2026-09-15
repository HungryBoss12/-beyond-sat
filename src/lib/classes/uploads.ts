import { supabase } from "@/integrations/supabase/client";
import { parseStorageRef } from "@/lib/storage-url";

function safeName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 80);
}

export async function uploadChatFile(file: File | Blob, filename?: string): Promise<{
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
}> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const name = filename || (file instanceof File ? file.name : "upload.bin");
  const path = `${u.user.id}/${Date.now()}-${safeName(name)}`;
  const { error } = await supabase.storage.from("chat-uploads").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return {
    storage_path: path,
    file_name: name,
    mime_type: file.type || null,
    byte_size: file.size ?? null,
  };
}

export async function uploadHomeworkFile(
  file: File | Blob,
  filename?: string,
  folder?: string,
): Promise<{
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  byte_size: number | null;
}> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const name = filename || (file instanceof File ? file.name : "upload.bin");
  const root = folder || u.user.id;
  const path = `${root}/${Date.now()}-${safeName(name)}`;
  const { error } = await supabase.storage.from("homework-uploads").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return {
    storage_path: path,
    file_name: name,
    mime_type: file.type || null,
    byte_size: file.size ?? null,
  };
}

export async function uploadAvatar(file: File): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${u.user.id}/avatar-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("chat-uploads").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (error) throw error;
  return path;
}

/** Resolve a stored avatar path (or a legacy signed HTTP URL) for display. */
export async function resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  const value = (stored ?? "").trim();
  if (!value) return null;
  if (/^data:/i.test(value)) return value;

  const parsed = parseStorageRef(value, "chat-uploads");
  if (parsed) {
    const { data, error } = await supabase.storage
      .from(parsed.bucket)
      .createSignedUrl(parsed.path, 3600);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  }

  return /^https?:\/\//i.test(value) ? value : null;
}

export async function resolveAvatarUrls(
  refs: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(refs.map((r) => (r ?? "").trim()).filter(Boolean))];
  await Promise.all(
    unique.map(async (ref) => {
      const url = await resolveAvatarUrl(ref);
      if (url) out.set(ref, url);
    }),
  );
  return out;
}
