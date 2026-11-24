import { supabase } from "@/integrations/supabase/client";

function safeName(name: string): string {
  return name.replace(/[^\w.-]+/g, "_").slice(0, 80);
}

function randomUploadToken(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
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
  const path = `${u.user.id}/${randomUploadToken()}-${safeName(name)}`;
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
  const cleanFolder = folder ? folder.replace(/^\/+|\/+$/g, "") : "";
  if (cleanFolder.includes("..")) throw new Error("Invalid upload folder");
  const root = cleanFolder || u.user.id;
  const path = `${root}/${randomUploadToken()}-${safeName(name)}`;
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

/** Profile pictures live in `src/lib/avatar`; these names stay importable from here. */
export { resolveAvatarUrl, resolveAvatarUrls } from "@/lib/avatar/urls";
export { uploadMyAvatar as uploadAvatar } from "@/lib/avatar/upload";
