import { jsonResponse, requireUser } from "@/lib/vocab/rest";
import { isValidUsername, normalizeUsername } from "@/lib/classes/types";
import { isSyntheticAccountEmail } from "./login-email";
import { firstLoginAuthUpdate, firstLoginErrorMessage } from "./first-login-update";
import { jsonReadError, readJsonLimited } from "@/lib/http/read-json";

export async function handleCompleteFirstLogin(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  const read = await readJsonLimited<{ password?: unknown; username?: unknown; email?: unknown }>(
    request,
  );
  if (!read.ok) return jsonResponse(jsonReadError(read.status), read.status);
  const body = read.value ?? {};

  const password = typeof body.password === "string" ? body.password : "";
  if (password.length < 8) {
    return jsonResponse({ error: "Password must be at least 8 characters." }, 400);
  }
  if (password.length > 72) {
    return jsonResponse({ error: "Password is too long." }, 400);
  }

  const nextEmail = typeof body.email === "string" ? body.email.trim() : "";
  if (nextEmail) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      return jsonResponse({ error: "Enter a valid email, or leave it blank." }, 400);
    }
    if (isSyntheticAccountEmail(nextEmail)) {
      return jsonResponse({ error: "Use a real email address." }, 400);
    }
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabaseAdmin as any;

  const { data: prof, error: profErr } = await db
    .from("profiles")
    .select("username,must_change_credentials")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (profErr || !prof) {
    return jsonResponse({ error: "Could not load your profile." }, 500);
  }
  if (!prof.must_change_credentials) {
    return jsonResponse({ ok: true, alreadyComplete: true });
  }

  let nextUsername = (prof.username as string | null) ?? null;
  if (typeof body.username === "string" && body.username.trim()) {
    const normalized = normalizeUsername(body.username);
    if (!isValidUsername(normalized)) {
      return jsonResponse(
        { error: "Username must start with a letter and be 3–24 letters, numbers, or underscores." },
        400,
      );
    }
    nextUsername = normalized;
  }

  const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(auth.user.id);
  if (userErr || !authUser.user) {
    return jsonResponse({ error: "Could not update your account." }, 500);
  }

  const update = firstLoginAuthUpdate({
    password,
    nextEmail,
    nextUsername,
    prevUsername: (prof.username as string | null) ?? null,
    currentEmail: authUser.user.email ?? null,
  });

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(
    auth.user.id,
    update.attributes,
  );
  if (updErr) {
    console.error("[first-login] update user failed", updErr.message);
    return jsonResponse({ error: firstLoginErrorMessage(updErr.message) }, 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (supabaseAdmin as any).rpc("bs_complete_first_login", {
    p_user_id: auth.user.id,
    p_username: nextUsername,
    p_email: update.attributes.email ?? null,
  });
  if (rpcErr) {
    console.error("[first-login] complete failed", rpcErr.message);
    const msg = firstLoginErrorMessage(rpcErr.message);
    return jsonResponse({ error: msg }, msg === "That username is already taken." ? 409 : 500);
  }

  return jsonResponse({ ok: true, pendingEmail: update.pendingEmail });
}
