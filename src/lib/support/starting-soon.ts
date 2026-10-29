/** Tells students their support lesson starts within five minutes. One notice per session. */
export async function notifySupportStarting(env: unknown): Promise<void> {
  const record = (env ?? {}) as { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
  if (!record.SUPABASE_URL || !record.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[support] start notices skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }
  const response = await fetch(`${record.SUPABASE_URL}/rest/v1/rpc/support_notify_starting_soon`, {
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
    throw new Error(`support_notify_starting_soon ${response.status}: ${body}`);
  }
  console.log("[support] start notices", await response.text());
}
