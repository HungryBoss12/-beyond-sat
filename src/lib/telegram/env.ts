import { readEnv } from "@/lib/server-env";

/** Mirror Worker secrets onto process.env for server-only Supabase client. */
export function hydrateServerEnv(env: unknown): void {
  if (typeof process === "undefined" || !process.env) return;
  const keys = [
    "SUPABASE_URL",
    "VITE_SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "TELEGRAM_BOT_TOKEN",
    "TELEGRAM_WEBHOOK_SECRET",
  ] as const;
  for (const key of keys) {
    const val = readEnv(env, key);
    if (val && !process.env[key]?.trim()) process.env[key] = val;
  }
  if (!process.env.SUPABASE_URL?.trim()) {
    const url = readEnv(env, "VITE_SUPABASE_URL");
    if (url) process.env.SUPABASE_URL = url;
  }
}

export function readTelegramToken(env: unknown): string | undefined {
  return readEnv(env, "TELEGRAM_BOT_TOKEN");
}

export function readWebhookSecret(env: unknown): string | undefined {
  return readEnv(env, "TELEGRAM_WEBHOOK_SECRET");
}
