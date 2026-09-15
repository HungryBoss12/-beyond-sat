import { jsonResponse, requireStaff, restFetch } from "@/lib/vocab/rest";
import { hydrateServerEnv } from "@/lib/server-env";
import { accountEmailFor, slugUsernameFromName } from "./login-email";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USERNAME_RE = /^[a-z][a-z0-9_]{2,23}$/;

function splitName(name: string): { first_name: string; last_name: string | null; full_name: string } {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first_name = parts[0] ?? name.trim();
  const last_name = parts.length > 1 ? parts.slice(1).join(" ") : null;
  return { first_name, last_name, full_name: name.trim() };
}

function normalizeUsernameOverride(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export async function handleAdminCreateUser(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  hydrateServerEnv(env);
  try {
    const { resetSupabaseAdmin, ensureSupabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    resetSupabaseAdmin();
    ensureSupabaseAdmin();
  } catch (e) {
    console.error("[create-user] service role config", (e as Error).message);
    return jsonResponse(
      {
        error:
          (e as Error).message ||
          "Server service role key is invalid. Set Cloudflare secret SUPABASE_SERVICE_ROLE_KEY to the project's service_role JWT or sb_secret_ key (not the publishable/anon key).",
      },
      500,
    );
  }

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  let body: {
    name?: unknown;
    password?: unknown;
    classId?: unknown;
    username?: unknown;
    mustChangeCredentials?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const classId = typeof body.classId === "string" ? body.classId.trim() : "";
  const usernameOverride =
    typeof body.username === "string" && body.username.trim()
      ? normalizeUsernameOverride(body.username)
      : "";
  const mustChangeCredentials =
    typeof body.mustChangeCredentials === "boolean" ? body.mustChangeCredentials : true;

  if (name.length < 2) return jsonResponse({ error: "Enter the student's name." }, 400);
  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  }
  if (password.length > 72) return jsonResponse({ error: "Password is too long." }, 400);
  if (!UUID_RE.test(classId)) return jsonResponse({ error: "Pick a class group first." }, 400);
  if (usernameOverride && !USERNAME_RE.test(usernameOverride)) {
    return jsonResponse(
      {
        error:
          "Username must start with a letter and use 3–24 characters (letters, numbers, underscore).",
      },
      400,
    );
  }

  const clsCheck = await restFetch<{ id: string }[]>(
    auth.config,
    auth.token,
    `classes?id=eq.${encodeURIComponent(classId)}&select=id`,
  );
  if (clsCheck.error) {
    console.error("[create-user] class lookup failed", clsCheck.status, clsCheck.error);
    return jsonResponse(
      { error: "Could not verify the class group. Try again or refresh the page." },
      500,
    );
  }
  if (!clsCheck.data?.length) {
    return jsonResponse({ error: "That class group was not found." }, 404);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { first_name, last_name, full_name } = splitName(name);
  const base = usernameOverride || slugUsernameFromName(name);

  const { data: takenRows } = await db
    .from("profiles")
    .select("username")
    .ilike("username", `${base}%`);
  const taken = new Set(
    ((takenRows ?? []) as { username: string | null }[])
      .map((r) => (r.username ?? "").toLowerCase())
      .filter(Boolean),
  );

  if (usernameOverride && taken.has(usernameOverride)) {
    return jsonResponse({ error: "That username is already taken." }, 409);
  }

  let username = base;
  if (!usernameOverride) {
    let n = 2;
    while (taken.has(username)) {
      const suffix = String(n++);
      username = `${base.slice(0, Math.max(3, 24 - suffix.length))}${suffix}`;
    }
  }

  const email = accountEmailFor(username);
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name,
      last_name,
      full_name,
      username,
      staff_created: true,
    },
  });
  if (createErr || !created.user) {
    const msg = createErr?.message ?? "Could not create the account.";
    if (/already/i.test(msg)) {
      return jsonResponse(
        { error: "That login name is already taken. Try a slightly different name." },
        409,
      );
    }
    if (/invalid api key/i.test(msg)) {
      console.error("[create-user] Invalid API key from Auth Admin — check SUPABASE_SERVICE_ROLE_KEY");
      return jsonResponse(
        {
          error:
            "Server service role key is invalid. Set Cloudflare secret SUPABASE_SERVICE_ROLE_KEY to the project's service_role JWT or sb_secret_ key (not the publishable/anon key).",
        },
        500,
      );
    }
    return jsonResponse({ error: msg }, 400);
  }

  const userId = created.user.id;
  for (let i = 0; i < 10; i++) {
    const { data: row } = await db.from("profiles").select("id").eq("id", userId).maybeSingle();
    if (row) break;
    await sleep(150);
  }

  const { data: updatedProfile, error: profErr } = await db
    .from("profiles")
    .update({
      username,
      first_name,
      last_name,
      full_name,
      email,
      must_change_credentials: mustChangeCredentials,
      intro_completed: false,
      staff_created: true,
      chat_setup_completed: true,
    })
    .eq("id", userId)
    .select("id")
    .maybeSingle();
  if (profErr || !updatedProfile) {
    console.error("[create-user] profile update failed", profErr?.message ?? "no row updated");
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return jsonResponse(
      {
        error: `Account was created but the profile could not be finished: ${
          profErr?.message ?? "profile row missing"
        }`,
      },
      500,
    );
  }

  await db.from("class_memberships").delete().eq("user_id", userId);
  const { error: memErr } = await db
    .from("class_memberships")
    .insert({ class_id: classId, user_id: userId });
  if (memErr) {
    await supabaseAdmin.auth.admin.deleteUser(userId);
    return jsonResponse(
      { error: `Account was created but could not be added to the class: ${memErr.message}` },
      500,
    );
  }

  return jsonResponse({ userId, username, name: full_name });
}
