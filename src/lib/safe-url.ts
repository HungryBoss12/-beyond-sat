/**
 * A page on https must never point a link, image, video, or frame at file://.
 * Firefox reports that as "Content at https://… may not load or link to file:///."
 */

const NAV_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);

export function safeNavigationUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value || /[\u0000-\u001f]/.test(value)) return null;
  if (/^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\") || /^file:/i.test(value)) return null;
  if (value.startsWith("#")) return value;
  if (value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")) return value;
  try {
    const url = new URL(value);
    if (!NAV_PROTOCOLS.has(url.protocol)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

/** http(s), a site path, or an in-page image. file: and other schemes are dropped. */
export function safeMediaUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (/^data:image\//i.test(value)) return value;
  const safe = safeNavigationUrl(value);
  if (!safe) return null;
  if (safe.startsWith("/") || /^https?:/i.test(safe)) return safe;
  return null;
}
