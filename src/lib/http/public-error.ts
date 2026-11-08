/**
 * Database and Auth messages name constraints and reveal which emails exist,
 * so callers get a fixed sentence and the detail goes to the Worker log.
 */
export function publicError(
  context: string,
  raw: string | null | undefined,
  fallback: string,
): string {
  console.error(`[${context}]`, raw);
  if (raw && /password/i.test(raw) && /(weak|should|must|least|character)/i.test(raw)) {
    return "Choose a stronger password.";
  }
  return fallback;
}
