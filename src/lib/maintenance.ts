import { callRpc, readBearerToken, readSupabaseConfig, verifySupabaseUser } from "./server-env";

/**
 * Global maintenance mode (master_plan.md §4B / §5C).
 *
 * The flag lives in `app_settings`, but that table is admin-only for SELECT —
 * so the public read goes through `get_maintenance_state()`, a SECURITY DEFINER
 * function granted to anon. Without it the flag would be invisible to exactly
 * the visitors it's meant to gate.
 */

export type MaintenanceState = { enabled: boolean; message: string };

const CACHE_TTL_MS = 30_000;

/* Module-scope cache. A Worker isolate is reused across requests, so this turns
   a per-request DB round trip into one every 30 seconds. The cost is that
   toggling maintenance takes up to 30s to propagate, which the admin UI says
   out loud. */
let cached: { state: MaintenanceState; at: number } | null = null;

/** Test seam and an escape hatch for the admin toggle to force a re-read. */
export function clearMaintenanceCache(): void {
  cached = null;
}

async function loadState(config: { url: string; anonKey: string }): Promise<MaintenanceState> {
  const rows = await callRpc<{ enabled: boolean; message: string | null }[]>(
    config,
    "get_maintenance_state",
    null,
  );
  const row = Array.isArray(rows) ? rows[0] : (rows as { enabled?: boolean; message?: string } | null);
  return {
    enabled: row?.enabled === true,
    message: typeof row?.message === "string" ? row.message : "",
  };
}

export async function getMaintenanceState(
  config: { url: string; anonKey: string },
  now: number,
): Promise<MaintenanceState> {
  if (cached && now - cached.at < CACHE_TTL_MS) return cached.state;
  const state = await loadState(config);
  cached = { state, at: now };
  return state;
}

/**
 * Paths that stay reachable while maintenance is on.
 *
 * `/signin` and the auth callback are the safety catch: without them an admin
 * who toggles maintenance from a session that later expires can never sign back
 * in to turn it off. `/api/*` stays open because the admin UI itself needs it,
 * and static assets are excluded so the pages that *are* served still render.
 */
const EXEMPT_PREFIXES = [
  "/signin",
  "/signup",
  "/auth",
  "/api/",
  "/_serverFn/",
  "/assets/",
  "/_build/",
  "/favicon",
  "/robots.txt",
  "/manifest",
];

export function isExemptPath(pathname: string): boolean {
  if (EXEMPT_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) return true;
  // Any request with a file extension is an asset request, not a page view.
  return /\.[a-z0-9]{2,5}$/i.test(pathname);
}

/**
 * Admin bypass (master_plan.md §4B). Admins keep full access so they can verify
 * the live site while the public sees the 503.
 *
 * The role check runs through `has_role`-backed RPC rather than trusting
 * anything in the token: a JWT claim would be forgeable relative to the actual
 * role table, and the role is what RLS uses everywhere else.
 */
async function isAdminRequest(
  config: { url: string; anonKey: string },
  request: Request,
): Promise<boolean> {
  const token = readBearerToken(request) ?? readTokenFromCookie(request);
  if (!token) return false;
  const user = await verifySupabaseUser(config, token);
  if (!user) return false;
  const result = await callRpc<boolean>(config, "is_admin", token);
  return result === true;
}

/**
 * Supabase-js stores the session in localStorage, not a cookie, so a plain
 * document navigation carries no Authorization header. This reads the cookie
 * Supabase sets when one is present; when it isn't, the admin's first page load
 * hits the 503 and the client-side check takes over after hydration.
 */
function readTokenFromCookie(request: Request): string | null {
  const cookie = request.headers.get("cookie");
  if (!cookie) return null;
  const match = /(?:^|;\s*)sb-[^=]*-auth-token=([^;]+)/.exec(cookie);
  if (!match) return null;
  try {
    const raw = decodeURIComponent(match[1]);
    // The cookie is either a bare token or a JSON session array, depending on
    // the supabase-js version that wrote it.
    if (raw.startsWith("[")) {
      const parsed = JSON.parse(raw) as unknown[];
      return typeof parsed[0] === "string" ? parsed[0] : null;
    }
    if (raw.startsWith("{")) {
      const parsed = JSON.parse(raw) as { access_token?: unknown };
      return typeof parsed.access_token === "string" ? parsed.access_token : null;
    }
    return raw || null;
  } catch {
    return null;
  }
}

/**
 * Returns the state to apply to this request, or null to let it through.
 * Never throws: a maintenance check that fails must not take the site down.
 */
export async function checkMaintenance(
  request: Request,
  env: unknown,
  now: number,
): Promise<MaintenanceState | null> {
  try {
    const url = new URL(request.url);
    if (isExemptPath(url.pathname)) return null;

    const config = readSupabaseConfig(env);
    if (!config) return null;

    const state = await getMaintenanceState(config, now);
    if (!state.enabled) return null;

    if (await isAdminRequest(config, request)) return null;
    return state;
  } catch (error) {
    console.error("[maintenance] check failed; allowing request", error);
    return null;
  }
}
