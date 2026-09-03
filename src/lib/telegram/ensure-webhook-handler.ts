import { callRpc, readBearerToken, readEnv, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";
import { readWebhookSecret } from "./env";
import { ensureTelegramWebhook } from "./webhook-setup";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

async function isAdminRequest(request: Request, env: unknown): Promise<boolean> {
  const config = readSupabaseConfig(env);
  if (!config) return false;
  const token = readBearerToken(request);
  if (!token) return false;
  const user = await verifySupabaseUser(config, token);
  if (!user) return false;
  const isAdmin = await callRpc<boolean>(config, token, "bs_is_admin", {});
  return isAdmin === true;
}

export async function handleEnsureTelegramWebhook(
  request: Request,
  env: unknown,
): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const setupToken = request.headers.get("X-Telegram-Setup-Token");
  const secret = readWebhookSecret(env);
  const setupAuthorized = !!secret && setupToken === secret;
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

  return json(result, result.ok ? 200 : 500);
}
