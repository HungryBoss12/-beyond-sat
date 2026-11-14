import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AVATARS_BUCKET, LEGACY_AVATAR_BUCKET, isStoredAvatarRef } from "./paths";

const TTL_SECONDS = 60 * 60;
const REFRESH_MARGIN_MS = 5 * 60 * 1000;
const SIGN_BATCH = 100;

type Cached = { url: string; expires: number };
const cache = new Map<string, Cached>();

export function invalidateAvatar(ref: string | null | undefined): void {
  if (ref) cache.delete(ref.trim());
}

async function signBucket(bucket: string, paths: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < paths.length; i += SIGN_BATCH) {
    const chunk = paths.slice(i, i + SIGN_BATCH);
    const { data } = await supabase.storage.from(bucket).createSignedUrls(chunk, TTL_SECONDS);
    for (const row of data ?? []) {
      if (row.signedUrl && !row.error && row.path) out.set(row.path, row.signedUrl);
    }
  }
  return out;
}

/**
 * Signed URLs for stored photo paths, one batched request per bucket. Only object
 * paths resolve: URLs and data: values are ignored. New photos live in `avatars`;
 * a path that is not there yet is looked up in the old `chat-uploads` bucket.
 */
export async function resolveAvatarUrls(
  refs: Array<string | null | undefined>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const now = Date.now();
  const missing: string[] = [];
  for (const raw of new Set(refs.map((r) => (r ?? "").trim()))) {
    if (!isStoredAvatarRef(raw)) continue;
    const hit = cache.get(raw);
    if (hit && hit.expires > now) out.set(raw, hit.url);
    else missing.push(raw);
  }
  if (missing.length === 0) return out;

  const fresh = await signBucket(AVATARS_BUCKET, missing);
  const legacy = missing.filter((path) => !fresh.has(path));
  if (legacy.length > 0) {
    for (const [path, url] of await signBucket(LEGACY_AVATAR_BUCKET, legacy)) fresh.set(path, url);
  }
  const expires = now + TTL_SECONDS * 1000 - REFRESH_MARGIN_MS;
  for (const [path, url] of fresh) {
    cache.set(path, { url, expires });
    out.set(path, url);
  }
  return out;
}

export async function resolveAvatarUrl(stored: string | null | undefined): Promise<string | null> {
  const value = (stored ?? "").trim();
  if (!value) return null;
  return (await resolveAvatarUrls([value])).get(value) ?? null;
}

/** Map of stored path to signed URL for everything in `refs`, resolved in one batch. */
export function useAvatarUrls(refs: Array<string | null | undefined>): Map<string, string> {
  const key = useMemo(
    () =>
      [...new Set(refs.map((r) => (r ?? "").trim()).filter(isStoredAvatarRef))].sort().join("|"),
    [refs],
  );
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!key) {
      setUrls(new Map());
      return;
    }
    let live = true;
    void resolveAvatarUrls(key.split("|")).then((map) => {
      if (live) setUrls(map);
    });
    return () => {
      live = false;
    };
  }, [key]);
  return urls;
}

let queue = new Set<string>();
let waiters: Array<(map: Map<string, string>) => void> = [];

/** Same as resolveAvatarUrls, but calls made in the same tick share one request. */
export function resolveAvatarUrlCoalesced(stored: string | null | undefined): Promise<string | null> {
  const value = (stored ?? "").trim();
  if (!isStoredAvatarRef(value)) return Promise.resolve(null);
  const hit = cache.get(value);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.url);
  queue.add(value);
  return new Promise((resolve) => {
    if (waiters.length === 0) {
      setTimeout(() => {
        const refs = [...queue];
        const pending = waiters;
        queue = new Set();
        waiters = [];
        void resolveAvatarUrls(refs)
          .catch(() => new Map<string, string>())
          .then((map) => pending.forEach((done) => done(map)));
      }, 10);
    }
    waiters.push((map) => resolve(map.get(value) ?? null));
  });
}

/** One photo URL for a stored path; many of these on a page still cost one request. */
export function useAvatarUrl(stored: string | null | undefined): string | null {
  const value = (stored ?? "").trim();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!value) {
      setUrl(null);
      return;
    }
    let live = true;
    void resolveAvatarUrlCoalesced(value).then((next) => {
      if (live) setUrl(next);
    });
    return () => {
      live = false;
    };
  }, [value]);
  return url;
}
