import { jsonResponse, requireAdmin } from "@/lib/vocab/rest";
import { hydrateServerEnv } from "@/lib/server-env";
import { jsonReadError, readJsonLimited } from "@/lib/http/read-json";
import { publicError } from "@/lib/http/public-error";

const FAILED = "Could not delete the account.";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const STAFF = ["admin", "editor", "teacher", "support_teacher"] as const;

export async function handleDeleteStudent(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);
  hydrateServerEnv(env);
  const auth = await requireAdmin(request, env);
  if (!auth.ok) return auth.response;

  const read = await readJsonLimited<{ userId?: unknown }>(request);
  if (!read.ok) return jsonResponse(jsonReadError(read.status), read.status);
  const body = read.value ?? {};

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!UUID_RE.test(userId)) return jsonResponse({ error: "Student not found." }, 404);
  if (userId === auth.user.id) {
    return jsonResponse({ error: "You cannot delete your own account here." }, 400);
  }

  const { ensureSupabaseAdmin, supabaseAdmin } = await import(
    "@/integrations/supabase/client.server"
  );
  ensureSupabaseAdmin();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: roles, error: roleErr } = await db
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .in("role", [...STAFF]);
  if (roleErr) {
    return jsonResponse({ error: publicError("delete-student/roles", roleErr.message, FAILED) }, 500);
  }
  if ((roles ?? []).length > 0) {
    return jsonResponse({ error: "Only student accounts can be deleted here." }, 400);
  }

  const { data: profile, error: profErr } = await db
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  if (profErr) {
    return jsonResponse({ error: publicError("delete-student/profile", profErr.message, FAILED) }, 500);
  }
  if (!profile) return jsonResponse({ error: "Student not found." }, 404);

  const { error: rosterErr } = await db.from("students").delete().eq("user_id", userId);
  if (rosterErr) {
    return jsonResponse({ error: publicError("delete-student/roster", rosterErr.message, FAILED) }, 500);
  }

  const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (delErr) {
    return jsonResponse({ error: publicError("delete-student/auth", delErr.message, FAILED) }, 400);
  }

  return jsonResponse({ ok: true });
}
