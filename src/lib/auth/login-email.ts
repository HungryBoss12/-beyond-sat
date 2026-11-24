export const ACCOUNT_EMAIL_DOMAIN = "accounts.beyondsat.local";

export function accountEmailFor(username: string): string {
  return `${username}@${ACCOUNT_EMAIL_DOMAIN}`;
}

/**
 * Unpredictable synthetic login email so attackers cannot bypass
 * `/api/auth/username-login` by hitting GoTrue's password endpoint directly
 * with `<username>@accounts.beyondsat.local`.
 */
export function uniqueAccountEmailFor(username: string): string {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${username}.${suffix}@${ACCOUNT_EMAIL_DOMAIN}`;
}

export function isSyntheticAccountEmail(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`);
}

export function displayAccountEmail(email: string | null | undefined): string | null {
  if (!email || isSyntheticAccountEmail(email)) return null;
  return email;
}

export function slugUsernameFromName(name: string): string {
  const cleaned = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 20);
  const withLetter = /^[a-z]/.test(cleaned) ? cleaned : `u${cleaned.replace(/^_+/, "")}`;
  const base = withLetter.length >= 3 ? withLetter : `user${withLetter}`;
  return base.slice(0, 24);
}
