import { hydrateServerEnv } from "@/lib/server-env";

export type SharedLimitResult = { ok: boolean; retryAfter: number };

async function adminRpc(
  env: unknown,
  fn: string,
  args: Record<string, unknown>,
): Promise<SharedLimitResult | null> {
  try {
    hydrateServerEnv(env);
    const { ensureSupabaseAdmin, supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );
    ensureSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabaseAdmin as any).rpc(fn, args);
    if (error || !data) {
      console.error(`[rate-limit] ${fn} failed`, error?.message);
      return null;
    }
    const row = data as { ok?: boolean; retry_after?: number };
    return { ok: row.ok === true, retryAfter: Math.max(0, Number(row.retry_after ?? 0)) };
  } catch (e) {
    console.error(`[rate-limit] ${fn} failed`, (e as Error).message);
    return null;
  }
}

/** Daily AI message cap stored in the database. Null when the database could not be reached. */
export function takeAiQuota(
  env: unknown,
  userId: string,
  max: number,
): Promise<SharedLimitResult | null> {
  return adminRpc(env, "bs_take_ai_quota", { p_user_id: userId, p_max: max });
}

/** Token bucket stored in the database. Null when the database could not be reached. */
export function takeRateToken(
  env: unknown,
  key: string,
  capacity: number,
  perMinute: number,
): Promise<SharedLimitResult | null> {
  return adminRpc(env, "bs_take_rate_token", {
    p_key: key,
    p_capacity: capacity,
    p_per_minute: perMinute,
  });
}

export function requestIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
