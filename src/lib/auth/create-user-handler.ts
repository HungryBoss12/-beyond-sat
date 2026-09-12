import { jsonResponse, requireStaff } from "@/lib/vocab/rest";
import { accountEmailFor, slugUsernameFromName } from "./login-email";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function splitName(name: string): { first_name: string; last_name: string | null; full_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] ?? name.trim();
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { first_name, last_name, full_name: name.trim() };
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function handleAdminCreateUser(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  let body: { name?: unknown; password?: unknown; classId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";

  if (name.length < 2) return jsonResponse({ error: "Enter the student's name." }, 400);
  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  }
  if (password.length > 72) return jsonResponse({ error: "Password is too long." }, 400);
  if (!UUID_RE.test(classId)) return jsonResponse({ error: "Pick a class group first." }, 400);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // Classes tables ship ahead of regenerated supabase types.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: cls, error: clsErr } = await db
    .from("classes")
    .select("id")
    .eq("id", classId)
    .maybeSingle();
  if (clsErr || !cls) return jsonResponse({ error: "That class group was not found." }, 404);

  const { first_name, last_name, full_name } = splitName(name);
  const base = slugUsernameFromName(name);

  const { data: takenRows } = await db
    .from("profiles")
    .select("username")
    .ilike("username", `${base}%`);
  const taken = new Set(
    ((takenRows ?? []) as { username: string | null }[])
      .map((r) => (r.username ?? "").toLowerCase())
      .filter(Boolean),
  );

  let username = base;
  let n = 2;
  while (taken.has(username)) {
    const suffix = String(n++);
    username = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
  }

  const email = accountEmailFor(username);
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { first_name, last_name, full_name, username },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create the account.";
    if (/already/i.test(msg)) {
      return jsonResponse({ error: "That login name is already taken. Try a slightly different name." }, 409);
    }
    return jsonResponse({ error: msg }, 400);
  }

  const userId = created.user.id;
  for (let i = 0; i < 10; i++) {
    const { data: row } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (row) break;
    await sleep(150);
  }

  const { error: profErr } = await db
    .from("profiles")
    .update({
      username,
      first_name,
      last_name,
      full_name,
      email,
      must_change_credentials: true,
      intro_completed: false,
      // Username + class membership are set here; avatar/telegram stay optional on Profile.
      chat_setup_completed: true,
    })
    .eq("id", userId);
  if (profErr) {
    console.error("[create-user] profile update failed", profErr.message);
    return jsonResponse(
      { error: `Account was created but the profile could not be finished: ${profErr.message}` },
      500,
    );
  }

  await db.from("class_memberships").delete().eq("user_id", userId);
  const { error: memErr } = await db
    .from("class_memberships")
    .insert({ class_id: classId, user_id: userId });
  if (memErr) {
    return jsonResponse(
      { error: `Account was created but could not be added to the class: ${memErr.message}` },
      500,
    );
  }

  return jsonResponse({ userId, username, name: full_name });
}
