/** Removes logins that have been in the basket for 14 days and have a zero balance. */
export async function purgeSettledStudents(env: unknown): Promise<void> {
  const record = (env ?? {}) as { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
  if (!record.SUPABASE_URL || !record.SUPABASE_SERVICE_ROLE_KEY) return;
  const response = await fetch(`${record.SUPABASE_URL}/rest/v1/rpc/purge_settled_student_accounts`, {
    method: "POST",
    headers: {
      apikey: record.SUPABASE_SERVICE_ROLE_KEY,
      authorization: `Bearer ${record.SUPABASE_SERVICE_ROLE_KEY}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`purge_settled_student_accounts ${response.status}: ${body}`);
  }
}
