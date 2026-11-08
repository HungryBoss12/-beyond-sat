/** The callback URL is attacker-controlled, so its text is never shown as-is. */
export function friendlyAuthError(message: string | null): string | null {
  if (!message) return null;
  const lower = message.toLowerCase();
  if (
    lower.includes("registration is closed") ||
    lower.includes("database error saving new user")
  ) {
    return "Registration is closed. Sign in with an account you already have, or ask your teacher for one.";
  }
  return "Sign-in didn't finish. Try again.";
}
