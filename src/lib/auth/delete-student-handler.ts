import { jsonResponse, requireAdmin } from "@/lib/vocab/rest";
import { hydrateServerEnv } from "@/lib/server-env";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF = ["admin", "editor", "teacher", "support_teacher"] as const;

export async function handleDeleteStudent(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  let body: { userId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!UUID_RE.test(userId)) return jsonResponse({ error: "Student not found." }, 404);
  if (userId === auth.user.id) {
    return jsonResponse({ error: "You cannot delete your own account here." }, 400);
  }

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
    .in("role", [...STAFF]);
  if (roleErr) return jsonResponse({ error: roleErr.message }, 500);
  if ((roles ?? []).length > 0) {
    return jsonResponse({ error: "Only student accounts can be deleted here." }, 400);
  }

  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profErr) return jsonResponse({ error: profErr.message }, 500);
  if (!profile) return jsonResponse({ error: "Student not found." }, 404);

  const { error: rosterErr } = await db.from("students").delete().eq("user_id", userId);
  if (rosterErr) return jsonResponse({ error: rosterErr.message }, 500);

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    return jsonResponse(
      { error: delErr.message || "Could not delete the account." },
      400,
    );
  }

  return jsonResponse({ ok: true });
}
