import { supabase } from "@/integrations/supabase/client";

/** Supabase Storage rejects / struggles with multi-year JWTs; keep under a year. */
const SIGNED_TTL_SECONDS = 60 * 60 * 24 * 365;
const UPLOAD_TIMEOUT_MS = 90_000;

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

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/**
 * Upload a figure to the private `question-images` bucket and return a
 * long-lived signed URL suitable for `questions.image_url`.
 */
export async function uploadQuestionImage(file: File | Blob, filename?: string): Promise<string> {
  return withTimeout(
    (async () => {
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
    })(),
    UPLOAD_TIMEOUT_MS,
    "Image upload timed out. Check your connection and try a smaller file.",
  );
}
