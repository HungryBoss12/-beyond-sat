/** Staff-facing name. Login usernames stay off these labels. */
export function staffName(
  person:
    | {
        first_name?: string | null;
        last_name?: string | null;
        full_name?: string | null;
      }
    | null
    | undefined,
): string {
  if (!person) return "Student";
  const joined = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  const full = person.full_name?.trim();
  return full || "Student";
}
