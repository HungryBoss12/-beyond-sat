/** Writes missing month charges and reprices this month's open ones. */
export async function applyRecurringFees(env: unknown): Promise<void> {
  const record = (env ?? {}) as { SUPABASE_URL?: string; SUPABASE_SERVICE_ROLE_KEY?: string };
  if (!record.SUPABASE_URL || !record.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("[billing] recurring fees skipped: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing");
    return;
  }
  const response = await fetch(
    `${record.SUPABASE_URL}/rest/v1/rpc/billing_apply_recurring_fees_system`,
    {
      method: "POST",
      headers: {
        apikey: record.SUPABASE_SERVICE_ROLE_KEY,
        authorization: `Bearer ${record.SUPABASE_SERVICE_ROLE_KEY}`,
        "content-type": "application/json",
      },
      body: "{}",
    },
  );
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`billing_apply_recurring_fees_system ${response.status}: ${body}`);
  }
  console.log("[billing] recurring fees applied", await response.text());
}
