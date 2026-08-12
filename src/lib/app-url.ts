/**
 * Public site origin for Supabase auth redirects.
 *
 * `VITE_APP_URL` is inlined at build time so confirmation emails always point
 * at production even when an admin tests signup from localhost.
 */
export function getAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

/** Build an absolute URL on this app (e.g. `/dashboard` → `https://…/dashboard`). */
export function appUrl(path: string): string {
  const origin = getAppOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${origin}${normalized}`;
}
