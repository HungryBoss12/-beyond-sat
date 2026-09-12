import { createClient } from "@supabase/supabase-js";
import { jsonResponse } from "@/lib/vocab/rest";
import { readSupabaseConfig } from "@/lib/server-env";
import { normalizeUsername } from "@/lib/classes/types";

export async function handleUsernameLogin(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) return jsonResponse({ error: "Server is not configured" }, 500);

  let body: { username?: unknown; password?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ error: "Invalid JSON" }, 400);
  }

  const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
  const password = typeof body.password === "string" ? body.password : "";
  if (username.length < 3 || !password) {
    return jsonResponse({ error: "Enter your username and password." }, 400);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: rows, error: lookupErr } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .ilike("username", username)
    .limit(1);
  if (lookupErr) {
    console.error("[username-login] lookup failed", lookupErr.message);
    return jsonResponse({ error: "Could not sign in. Try again." }, 500);
  }
  const profile = (rows ?? [])[0] as { id: string } | undefined;
  if (!profile) {
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }

  const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (userErr || !email) {
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }

  const anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }

  return jsonResponse({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
