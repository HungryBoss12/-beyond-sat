/**
 * Server-side environment access for the Worker.
 *
 * Values arrive two ways depending on how the Worker was started: Wrangler
 * passes them as the `env` argument to `fetch`, while `nodejs_compat` also
 * mirrors them onto `process.env`. Local `vite dev` only has the latter. Reading
 * both, in that order, is what makes the same code work in dev and on the edge.
 */
export type WorkerEnv = Record<string, unknown>;

export function readEnv(env: unknown, key: string): string | undefined {
  /* Trimmed because these values are pasted by hand into the Cloudflare
     dashboard or piped into `wrangler secret put`, and a trailing newline
     survives both. An API key with a stray "\n" produces
     `Authorization: Bearer sk-...\n`, which upstreams reject as an invalid
     credential — OpenRouter answers that with 401 "User not found.", an error
     that reads as a dead account rather than a malformed header. */
  const fromArg = env && typeof env === "object" ? (env as WorkerEnv)[key] : undefined;
  if (typeof fromArg === "string" && fromArg.trim()) return fromArg.trim();

  const fromProcess = typeof process !== "undefined" && process.env ? process.env[key] : undefined;
  return fromProcess?.trim() || undefined;
}

export type SupabaseConfig = { url: string; anonKey: string };

export function readSupabaseConfig(env: unknown): SupabaseConfig | null {
  const url = readEnv(env, "SUPABASE_URL") ?? readEnv(env, "VITE_SUPABASE_URL");
  const anonKey =
    readEnv(env, "SUPABASE_PUBLISHABLE_KEY") ?? readEnv(env, "VITE_SUPABASE_PUBLISHABLE_KEY");
  if (!url || !anonKey) return null;
  return { url, anonKey };
}

/** Bearer token from the Authorization header, if present and non-empty. */
export function readBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  return match ? match[1].trim() || null : null;
}

export type VerifiedUser = { id: string; email: string | null };

/**
 * Verifies a Supabase access token by asking GoTrue who it belongs to.
 *
 * Deliberately not local JWT verification: that needs the project's signing key
 * and wouldn't notice a revoked session. This is one edge-to-Supabase round trip
 * on a request that's about to make a much slower call to OpenRouter anyway.
 */
export async function verifySupabaseUser(
  config: SupabaseConfig,
  token: string,
): Promise<VerifiedUser | null> {
  try {
    const response = await fetch(`${config.url}/auth/v1/user`, {
      headers: { apikey: config.anonKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) return null;
    const user = (await response.json()) as { id?: unknown; email?: unknown };
    if (typeof user.id !== "string" || !user.id) return null;
    return { id: user.id, email: typeof user.email === "string" ? user.email : null };
  } catch (error) {
    console.error("[auth] token verification failed", error);
    return null;
  }
}

/**
 * Returns true when the bearer token belongs to an admin or editor.
 *
 * Import routes call this after `verifySupabaseUser` so a signed-in student
 * would otherwise burn quota through `/api/import/*`.
 */
export async function verifyStaffUser(config: SupabaseConfig, token: string): Promise<boolean> {
  const result = await callRpc<boolean>(config, "bs_is_staff", token);
  return result === true;
}

/**
 * Calls a Postgres function through PostgREST.
 *
 * The caller's token is forwarded when supplied so RLS and `auth.uid()` see the
 * real user; without one the call runs as `anon`, which is what the public
 * maintenance check needs.
 */
export async function callRpc<T>(
  config: SupabaseConfig,
  fn: string,
  token?: string | null,
  body: unknown = {},
): Promise<T | null> {
  try {
    const response = await fetch(`${config.url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token || config.anonKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      console.error(`[rpc] ${fn} returned ${response.status}`);
      return null;
    }
    return (await response.json()) as T;
  } catch (error) {
    console.error(`[rpc] ${fn} failed`, error);
    return null;
  }
}
