import { format } from "date-fns";
import type { SupabaseConfig } from "@/lib/server-env";

type RestResult<T> = { data: T | null; error: string | null; status: number };

export async function restFetch<T>(
  config: SupabaseConfig,
  token: string,
  path: string,
  init?: RequestInit,
): Promise<RestResult<T>> {
  try {
    const response = await fetch(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
    const text = await response.text();
    if (!response.ok) {
      return { data: null, error: text || response.statusText, status: response.status };
    }
    if (!text) return { data: null, error: null, status: response.status };
    return { data: JSON.parse(text) as T, error: null, status: response.status };
  } catch (e) {
    return { data: null, error: e instanceof Error ? e.message : "Request failed", status: 500 };
  }
}

export async function restRpc<T>(
  config: SupabaseConfig,
  token: string,
  fn: string,
  body: Record<string, unknown> = {},
): Promise<RestResult<T>> {
  return restFetch<T>(config, token, `rpc/${fn}`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function todayDateStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export async function requireUser(
  request: Request,
  env: unknown,
): Promise<
  | { ok: true; user: { id: string; email: string | null }; token: string; config: SupabaseConfig }
  | { ok: false; response: Response }
> {
  const { readBearerToken, readSupabaseConfig, verifySupabaseUser } =
    await import("@/lib/server-env");
  const config = readSupabaseConfig(env);
  if (!config) {
    return { ok: false, response: jsonResponse({ error: "Server is not configured" }, 500) };
  }
  const token = readBearerToken(request);
  if (!token) {
    return { ok: false, response: jsonResponse({ error: "Sign in required" }, 401) };
  }
  const user = await verifySupabaseUser(config, token);
  if (!user) {
    return { ok: false, response: jsonResponse({ error: "Session expired" }, 401) };
  }
  return { ok: true, user, token, config };
}

export async function requireStaff(
  request: Request,
  env: unknown,
): Promise<
  | { ok: true; user: { id: string }; token: string; config: SupabaseConfig }
  | { ok: false; response: Response }
> {
  const auth = await requireUser(request, env);
  if (!auth.ok) return auth;
  const staff = await restRpc<boolean>(auth.config, auth.token, "bs_is_staff", {});
  if (!staff.data) {
    return { ok: false, response: jsonResponse({ error: "Staff access required" }, 403) };
  }
  return { ok: true, user: auth.user, token: auth.token, config: auth.config };
}
