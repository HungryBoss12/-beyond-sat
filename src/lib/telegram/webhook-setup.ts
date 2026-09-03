import { readEnv } from "@/lib/server-env";
import { readTelegramToken, readWebhookSecret } from "./env";

const TELEGRAM_API = "https://api.telegram.org";

export type WebhookEnsureResult = {
  ok: boolean;
  action: "unchanged" | "registered" | "updated" | "skipped" | "failed";
  detail?: string;
  webhookUrl?: string;
};

function resolvePublicUrl(env: unknown, requestUrl?: string): string | undefined {
  const fromEnv = readEnv(env, "WORKER_PUBLIC_URL");
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (requestUrl) {
    try {
      const url = new URL(requestUrl);
      return `${url.protocol}//${url.host}`;
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export async function ensureTelegramWebhook(
  env: unknown,
  requestUrl?: string,
): Promise<WebhookEnsureResult> {
  const token = readTelegramToken(env);
  const secret = readWebhookSecret(env);
  const publicUrl = resolvePublicUrl(env, requestUrl);

  if (!token || !secret) {
    return {
      ok: false,
      action: "skipped",
      detail: "TELEGRAM_BOT_TOKEN or TELEGRAM_WEBHOOK_SECRET not configured",
    };
  }
  if (!publicUrl) {
    return {
      ok: false,
      action: "skipped",
      detail: "WORKER_PUBLIC_URL not configured",
    };
  }

  const webhookUrl = `${publicUrl}/api/telegram/webhook`;

  try {
    const infoRes = await fetch(`${TELEGRAM_API}/bot${token}/getWebhookInfo`);
    const info = (await infoRes.json()) as {
      ok?: boolean;
      result?: { url?: string; last_error_message?: string };
    };
    const current = info.result?.url ?? "";

    if (current === webhookUrl) {
      return { ok: true, action: "unchanged", webhookUrl };
    }

    const setRes = await fetch(`${TELEGRAM_API}/bot${token}/setWebhook`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: secret,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });
    const set = (await setRes.json()) as { ok?: boolean; description?: string };
    if (!set.ok) {
      return {
        ok: false,
        action: "failed",
        detail: set.description ?? "setWebhook failed",
        webhookUrl,
      };
    }

    return {
      ok: true,
      action: current ? "updated" : "registered",
      webhookUrl,
      detail: info.result?.last_error_message ?? undefined,
    };
  } catch (e) {
    return {
      ok: false,
      action: "failed",
      detail: e instanceof Error ? e.message : "Webhook setup failed",
      webhookUrl,
    };
  }
}
