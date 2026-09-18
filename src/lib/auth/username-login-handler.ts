import { createClient } from "@supabase/supabase-js";
import { jsonResponse } from "@/lib/vocab/rest";
import { readSupabaseConfig } from "@/lib/server-env";
import { normalizeUsername } from "@/lib/classes/types";
import { rateLimit } from "@/lib/rate-limit";

/** Coarse client key for rate limiting: IP when present, else "unknown". */
function clientKey(request: Request): string {
  const ip =
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  return ip;
}

/** Constant 300ms floor so a failed lookup and a real bcrypt verify take the
    same wall-clock time — removes the timing side channel for username
    enumeration (successful logins do a Supabase round-trip, misses don't). */
async function timingFloor(startedAt: number): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < 300) {
    await new Promise((r) => setTimeout(r, 300 - elapsed));
  }
}

export async function handleUsernameLogin(request: Request, env: unknown): Promise<Response> {
  const startedAt = Date.now();
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) return jsonResponse({ error: "Server is not configured" }, 500);

  /* Brute-force throttle: 5 tokens, refill 1 per 3 minutes (5 per 15min per
     IP, matching the plan). Per-isolate caveat applies (lib/rate-limit.ts).
     Runs before body parsing so junk requests are rejected at the door. */
  const ip = clientKey(request);
  const limit = rateLimit(`username-login:${ip}`, 5, 1 / 3);
  if (!limit.ok) {
    return jsonResponse(
      { error: "Too many sign-in attempts. Wait a few minutes and try again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter) } },
    );
  }

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
    .select("id,banned")
    .eq("username", username)
    .limit(1);
  if (lookupErr) {
    await timingFloor(startedAt);
    console.error("[username-login] lookup failed", lookupErr.message);
    return jsonResponse({ error: "Could not sign in. Try again." }, 500);
  }
  const profile = (rows ?? [])[0] as { id: string; banned: boolean | null } | undefined;
  if (!profile) {
    await timingFloor(startedAt);
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }
  if (profile.banned) {
    await timingFloor(startedAt);
    return jsonResponse({ error: "This account is banned." }, 403);
  }

  const { data: authUser, error: userErr } = await supabaseAdmin.auth.admin.getUserById(profile.id);
  const email = authUser.user?.email;
  if (userErr || !email) {
    await timingFloor(startedAt);
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }

  const anon = createClient(config.url, config.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    await timingFloor(startedAt);
    return jsonResponse({ error: "That username and password don't match." }, 401);
  }

  return jsonResponse({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
}
