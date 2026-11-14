type PurgeEnv = { SUPABASE_URL: string; SUPABASE_SERVICE_ROLE_KEY: string };

function serviceHeaders(env: PurgeEnv): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
    "content-type": "application/json",
  };
}

/** Deletes the profile photos a removed account left in storage. A failure here never blocks the purge. */
async function deleteAvatarFiles(env: PurgeEnv, userId: string): Promise<void> {
  for (const bucket of ["avatars", "chat-uploads"]) {
    const listed = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: serviceHeaders(env),
      body: JSON.stringify({ prefix: userId, limit: 100 }),
    });
    if (!listed.ok) continue;
    const rows = (await listed.json()) as Array<{ name?: string }>;
    const paths = rows
      .map((row) => row.name ?? "")
      .filter((name) => (bucket === "avatars" ? name !== "" : name.startsWith("avatar-")))
      .map((name) => `${userId}/${name}`);
    if (paths.length === 0) continue;
    await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method: "DELETE",
      headers: serviceHeaders(env),
      body: JSON.stringify({ prefixes: paths }),
    });
  }
}

/** Removes logins that have been in the basket for 14 days and have a zero balance. */
export async function purgeSettledStudents(env: unknown): Promise<void> {
  const record = (env ?? {}) as Partial<PurgeEnv>;
  if (!record.SUPABASE_URL || !record.SUPABASE_SERVICE_ROLE_KEY) return;
  const config = record as PurgeEnv;
  const response = await fetch(`${config.SUPABASE_URL}/rest/v1/rpc/purge_settled_student_accounts`, {
    method: "POST",
    headers: serviceHeaders(config),
    body: "{}",
  });
  if (!response.ok) {
    const body = (await response.text()).slice(0, 300);
    throw new Error(`purge_settled_student_accounts ${response.status}: ${body}`);
  }
  const removed = (await response.json().catch(() => [])) as unknown;
  if (!Array.isArray(removed)) return;
  for (const id of removed) {
    if (typeof id !== "string") continue;
    await deleteAvatarFiles(config, id).catch(() => undefined);
  }
}
