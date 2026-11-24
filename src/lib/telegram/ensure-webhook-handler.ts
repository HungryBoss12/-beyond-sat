import { callRpc, readBearerToken, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";
import { requestIp, sharedRateLimit } from "@/lib/shared-rate-limit";
import { timingSafeEqual } from "./api";
import { readWebhookSecret } from "./env";
import { ensureTelegramWebhook } from "./webhook-setup";

function json(
  body: unknown,
  init?: number | { status: number; headers?: Record<string, string> },
): Response {
  const status = typeof init === "number" ? init : (init?.status ?? 200);
  const headers: Record<string, string> = {
    "content-type": "application/json; charset=utf-8",
    ...(typeof init === "number" ? {} : (init?.headers ?? {})),
  };
  return new Response(JSON.stringify(body), { status, headers });
}

async function isAdminRequest(request: Request, env: unknown): Promise<boolean> {
  const config = readSupabaseConfig(env);
  if (!config) return false;
  const token = readBearerToken(request);
  if (!token) return false;
  const user = await verifySupabaseUser(config, token);
  if (!user) return false;
  const isAdmin = await callRpc<boolean>(config, "bs_is_admin", token, {});
  return isAdmin === true;
}

export async function handleEnsureTelegramWebhook(
  request: Request,
  env: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const limit = await sharedRateLimit(env, `tg-ensure:${requestIp(request)}`, 10, 2);
  if (!limit.ok) {
    return json(
      { error: "Too many requests. Wait a minute and try again." },
      { status: 429, headers: { "retry-after": String(limit.retryAfter || 60) } },
    );
  }

  const setupToken = request.headers.get("X-Telegram-Setup-Token");
  const secret = readWebhookSecret(env);
  const setupAuthorized = !!secret && !!setupToken && (await timingSafeEqual(setupToken, secret));
  const adminAuthorized = await isAdminRequest(request, env);

  if (!setupAuthorized && !adminAuthorized) {
    return json({ error: "Unauthorized" }, 401);
  }

  const result = await ensureTelegramWebhook(env, request.url);
  if (!result.ok && result.action !== "skipped") {
    console.error("[telegram] webhook ensure failed", result);
  } else {
    console.log("[telegram] webhook ensure", result.action, result.webhookUrl ?? "");
  }

  return json(
    {
      ok: result.ok,
      action: result.action,
      ...(result.webhookUrl ? { webhookUrl: result.webhookUrl } : {}),
    },
    result.ok ? 200 : 500,
  );
}
