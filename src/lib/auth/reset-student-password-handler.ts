import { jsonResponse, requireAdmin } from "@/lib/vocab/rest";
import { hydrateServerEnv, readEnv } from "@/lib/server-env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function serviceAuth(): { url: string; key: string } | null {
  const url = (
    process.env.SUPABASE_URL?.trim() ||
    process.env.VITE_SUPABASE_URL?.trim() ||
    readEnv(undefined, "SUPABASE_URL") ||
    ""
  ).replace(/\/$/, "");
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    readEnv(undefined, "SUPABASE_SERVICE_ROLE_KEY") ||
    "";
  if (!url || !key) return null;
  return { url, key };
}

/** Drop every session so the next visit has to use the temporary password. */
async function signOutEverywhere(userId: string): Promise<void> {
  const creds = serviceAuth();
  if (!creds) return;
  const response = await fetch(`${creds.url}/auth/v1/admin/users/${userId}/logout`, {
    method: "POST",
    headers: {
      apikey: creds.key,
      Authorization: `Bearer ${creds.key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ scope: "global" }),
  });
  if (!response.ok) {
    console.error("[reset-password] could not sign the student out", response.status);
  }
}

export async function handleResetStudentPassword(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  let body: { userId?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  if (!UUID_RE.test(userId)) return jsonResponse({ error: "Student not found." }, 404);
  if (userId === auth.user.id) {
    return jsonResponse({ error: "Change your own password from Profile." }, 400);
  }
  if (password.length < 8) return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  if (password.length > 72) return jsonResponse({ error: "Password is too long." }, 400);

  const { resetSupabaseAdmin, ensureSupabaseAdmin, supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  resetSupabaseAdmin();
  ensureSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: roles, error: roleErr } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin"]);
  if (roleErr) return jsonResponse({ error: roleErr.message }, 500);
  if ((roles ?? []).length > 0) {
    return jsonResponse({ error: "Admin passwords are changed from that person's own profile." }, 400);
  }

  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profErr) return jsonResponse({ error: profErr.message }, 500);
  if (!profile) return jsonResponse({ error: "Student not found." }, 404);

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, { password });
  if (updErr) return jsonResponse({ error: updErr.message }, 400);

  const { error: flagErr } = await db
    .from("profiles")
    .update({ must_change_credentials: true })
    .eq("id", userId);
  if (flagErr) return jsonResponse({ error: flagErr.message }, 500);

  await signOutEverywhere(userId);
  return jsonResponse({ ok: true });
}
