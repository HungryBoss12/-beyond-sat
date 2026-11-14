export const AVATARS_BUCKET = "avatars";
export const LEGACY_AVATAR_BUCKET = "chat-uploads";
export const AVATAR_SIZE_PX = 512;
export const AVATAR_MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const BIO_MAX = 70;

const PATH_RE = /^([0-9a-f-]{36})\/avatar-[A-Za-z0-9_-]{6,64}\.(webp|jpg|jpeg|png)$/i;

/** True when `path` is a photo object that lives in `userId`'s own folder. */
export function isAvatarPath(path: string | null | undefined, userId: string): boolean {
  const match = (path ?? "").match(PATH_RE);
  return Boolean(match && match[1].toLowerCase() === userId.toLowerCase());
}

/** A stored value that is an object path we can sign (not a URL, not a data: URI). */
export function isStoredAvatarRef(value: string | null | undefined): boolean {
  return PATH_RE.test((value ?? "").trim());
}

export function newAvatarPath(userId: string, ext: "webp" | "jpg", token: string): string {
  return `${userId}/avatar-${token}.${ext}`;
}

/** Largest centred square that fits in a `width` by `height` image. */
export function cropSquare(width: number, height: number): { sx: number; sy: number; size: number } {
  const size = Math.max(0, Math.min(width, height));
  return { sx: Math.floor((width - size) / 2), sy: Math.floor((height - size) / 2), size };
}

/** Output edge: never upscale a small photo beyond what it has. */
export function outputEdge(size: number, target = AVATAR_SIZE_PX): number {
  return Math.max(1, Math.min(size, target));
}
