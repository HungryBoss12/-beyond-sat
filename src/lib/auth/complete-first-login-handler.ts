import { jsonResponse, requireUser } from "@/lib/vocab/rest";
import { isValidUsername, normalizeUsername } from "@/lib/classes/types";
import { accountEmailFor, isSyntheticAccountEmail } from "./login-email";

export async function handleCompleteFirstLogin(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const auth = await requireUser(request, env);
  if (!auth.ok) return auth.response;

  let body: { password?: unknown; username?: unknown; email?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

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

  const currentEmail = authUser.user.email ?? null;
  let authEmail: string | undefined;
  if (nextEmail) {
    authEmail = nextEmail;
  } else if (
    nextUsername &&
    nextUsername !== prof.username &&
    isSyntheticAccountEmail(currentEmail)
  ) {
    authEmail = accountEmailFor(nextUsername);
  }

  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(auth.user.id, {
    password,
    ...(authEmail ? { email: authEmail, email_confirm: true } : {}),
  });
  if (updErr) {
    return jsonResponse({ error: updErr.message }, 400);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: rpcErr } = await (supabaseAdmin as any).rpc("bs_complete_first_login", {
    p_user_id: auth.user.id,
    p_username: nextUsername,
    p_email: nextEmail || authEmail || null,
  });
  if (rpcErr) {
    const msg = rpcErr.message ?? "Could not finish setup.";
    if (/username taken/i.test(msg)) {
      return jsonResponse({ error: "That username is already taken." }, 409);
    }
    return jsonResponse({ error: msg }, 500);
  }

  return jsonResponse({ ok: true });
}
