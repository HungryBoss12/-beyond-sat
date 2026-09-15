import { hydrateServerEnv as hydrate, readEnv } from "@/lib/server-env";

/** Mirror Worker secrets onto process.env for server-only Supabase client. */
export const hydrateServerEnv = hydrate;

export function readTelegramToken(env: unknown): string | undefined {
  return readEnv(env, "TELEGRAM_BOT_TOKEN");
}

export function readWebhookSecret(env: unknown): string | undefined {
  return readEnv(env, "TELEGRAM_WEBHOOK_SECRET");
}
