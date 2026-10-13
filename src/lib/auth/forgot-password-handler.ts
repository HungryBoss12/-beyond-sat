import { createClient } from "@supabase/supabase-js";
import { jsonResponse } from "@/lib/vocab/rest";
import { readEnv, readSupabaseConfig } from "@/lib/server-env";
import { normalizeUsername } from "@/lib/classes/types";
import { isSyntheticAccountEmail } from "@/lib/auth/login-email";

const RESET_ORIGIN = "https://beyondsat.uz";

function clientKey(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** Always the public site. Request headers must not choose where the reset link opens. */
function resetRedirect(env: unknown): string {
  const configured = readEnv(env, "VITE_APP_URL")?.replace(/\/$/, "");
  return `${configured || RESET_ORIGIN}/reset-password`;
}

/**
 * Sends a Supabase recovery email for a real address or a username.
 * Accounts that only have a synthetic login address cannot receive mail.
 */
export async function handleForgotPassword(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  const config = readSupabaseConfig(env);
  if (!config) return jsonResponse({ error: "Server is not configured" }, 500);

  let body: { identifier?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const identifier = typeof body.identifier === "string" ? body.identifier.trim() : "";
  if (!identifier) return jsonResponse({ error: "Enter your username or email." }, 400);

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const ip = clientKey(request);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: limitData, error: limitErr } = await (supabaseAdmin as any).rpc("bs_take_login_attempt", {
    p_key: `reset:${ip}`,
  });
  const limit = limitData as { ok?: boolean; retry_after?: number } | null;
  if (limitErr || !limit) return jsonResponse({ error: "Could not send the reset email. Try again." }, 503);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many reset attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "retry-after": String(limit.retry_after ?? 180) } },
    );
  }

  let email = identifier.includes("@") ? identifier : "";
  if (!email) {
    const username = normalizeUsername(identifier);
    if (username.length < 3) return jsonResponse({ error: "Enter your username or email." }, 400);
    const { data: rows, error: lookupErr } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("username", username)
      .limit(1);
    if (lookupErr) return jsonResponse({ error: "Could not send the reset email. Try again." }, 500);
    const profile = (rows ?? [])[0] as { id: string } | undefined;
    if (!profile) return jsonResponse({ ok: true });
    const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
    if (userErr || !authUser.user?.email) return jsonResponse({ ok: true });
    email = authUser.user.email;
  }

  // Same response as an unknown account, so this cannot confirm a username.
  if (isSyntheticAccountEmail(email)) return jsonResponse({ ok: true });

  const redirectTo = resetRedirect(env);

  const anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await anon.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) console.error("[forgot-password]", error.message);
  return jsonResponse({ ok: true });
}
