import { supabase } from "@/integrations/supabase/client";

export const QUESTION_IMAGES_BUCKET = "question-images";
export const HOMEWORK_UPLOADS_BUCKET = "homework-uploads";

const DISPLAY_TTL_SECONDS = 60 * 60;
const SIGN_BATCH = 50;

const OBJECT_URL_RE =
  /\/storage\/v1\/object\/(?:sign|public|authenticated)\/([^/?#]+)\/([^?#]+)/i;

export type StorageRef = { bucket: string; path: string };

/** Parse a stored path, signed URL, or bucket-prefixed ref into `{ bucket, path }`. */
export function parseStorageRef(
  raw: string | null | undefined,
  defaultBucket = QUESTION_IMAGES_BUCKET,
): StorageRef | null {
  const value = (raw ?? "").trim();
  if (!value || /^data:/i.test(value)) return null;

  const fromUrl = value.match(OBJECT_URL_RE);
  if (fromUrl) {
    return {
      bucket: decodeURIComponent(fromUrl[1]),
      path: decodeURIComponent(fromUrl[2]),
    };
  }

  if (/^https?:\/\//i.test(value)) return null;

  const known = value.match(/^(question-images|homework-uploads)\/(.+)$/);
  if (known) {
    return { bucket: known[1], path: known[2] };
  }

  if (value.startsWith("/") || value.includes("://")) return null;

  return { bucket: defaultBucket, path: value.replace(/^\/+/, "") };
}

/**
 * Persistable DB value: object path for question images, `homework-uploads/...`
 * for notifications. Never a `data:` URL.
 */
export function toPersistableImageRef(
  raw: string | null | undefined,
  defaultBucket = QUESTION_IMAGES_BUCKET,
): string | null {
  const value = (raw ?? "").trim();
  if (!value || /^data:/i.test(value)) return null;
  const parsed = parseStorageRef(value, defaultBucket);
  if (!parsed) {
    return /^https?:\/\//i.test(value) ? value : null;
  }
  if (parsed.bucket === HOMEWORK_UPLOADS_BUCKET) {
    return `${HOMEWORK_UPLOADS_BUCKET}/${parsed.path}`;
  }
  return parsed.path;
}

/** Batch-sign stored refs for display (1 hour). Maps each original ref to a usable URL. */
export async function resolveDisplayUrls(
  refs: Array<string | null | undefined>,
  defaultBucket = QUESTION_IMAGES_BUCKET,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const byBucket = new Map<string, Map<string, string[]>>();

  for (const raw of refs) {
    const value = (raw ?? "").trim();
    if (!value) continue;
    if (/^data:/i.test(value)) {
      out.set(value, value);
      continue;
    }
    const parsed = parseStorageRef(value, defaultBucket);
    if (!parsed) {
      out.set(value, value);
      continue;
    }
    let paths = byBucket.get(parsed.bucket);
    if (!paths) {
      paths = new Map();
      byBucket.set(parsed.bucket, paths);
    }
    const originals = paths.get(parsed.path) ?? [];
    originals.push(value);
    paths.set(parsed.path, originals);
  }

  await Promise.all(
    [...byBucket.entries()].map(async ([bucket, paths]) => {
      const pathList = [...paths.keys()];
      for (let i = 0; i < pathList.length; i += SIGN_BATCH) {
        const chunk = pathList.slice(i, i + SIGN_BATCH);
        const { data } = await supabase.storage
          .from(bucket)
          .createSignedUrls(chunk, DISPLAY_TTL_SECONDS);
        if (!data) continue;
        for (const row of data) {
          if (!row.signedUrl || row.error) continue;
          for (const original of paths.get(row.path) ?? []) {
            out.set(original, row.signedUrl);
          }
        }
      }
    }),
  );

  return out;
}

export async function resolveDisplayUrl(
  ref: string | null | undefined,
  defaultBucket = QUESTION_IMAGES_BUCKET,
): Promise<string | null> {
  const value = (ref ?? "").trim();
  if (!value) return null;
  const map = await resolveDisplayUrls([value], defaultBucket);
  return map.get(value) ?? value;
}

/** Replace `image_url` on each row with a freshly signed display URL when needed. */
export async function applyResolvedImageUrls<T extends { image_url?: string | null }>(
  rows: T[],
  defaultBucket = QUESTION_IMAGES_BUCKET,
): Promise<T[]> {
  const map = await resolveDisplayUrls(
    rows.map((r) => r.image_url),
    defaultBucket,
  );
  return rows.map((r) => {
    const raw = r.image_url;
    if (!raw) return r;
    const next = map.get(raw);
    return next && next !== raw ? { ...r, image_url: next } : r;
  });
}
