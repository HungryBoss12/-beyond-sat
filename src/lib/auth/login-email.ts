export const ACCOUNT_EMAIL_DOMAIN = "accounts.beyondsat.local";

export function accountEmailFor(username: string): string {
  return `${username}@${ACCOUNT_EMAIL_DOMAIN}`;
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
