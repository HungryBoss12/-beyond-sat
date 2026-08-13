import { supabase } from "@/integrations/supabase/client";

const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365 * 5;

function extensionFor(file: File | Blob, filename?: string): string {
  if (filename) {
    const ext = filename.split(".").pop()?.toLowerCase();
    if (ext) return ext;
  }
  if (file instanceof File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext) return ext;
  }
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "image/gif") return "gif";
  return "jpg";
}

/**
 * Upload a figure to the private `question-images` bucket and return a
 * long-lived signed URL suitable for `questions.image_url`.
 */
export async function uploadQuestionImage(file: File | Blob, filename?: string): Promise<string> {
  const ext = extensionFor(file, filename);
  const path = `${crypto.randomUUID()}.${ext}`;
  const contentType = file.type || (ext === "png" ? "image/png" : "image/jpeg");
  const { error } = await supabase.storage.from("question-images").upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw new Error(error.message);

  const { data: signed, error: signErr } = await supabase.storage
    .from("question-images")
    .createSignedUrl(path, SIGNED_TTL_SECONDS);
  if (signErr || !signed?.signedUrl) {
    throw new Error(signErr?.message ?? "Could not create a URL for that image.");
  }
  return signed.signedUrl;
}
