#!/usr/bin/env node
/**
 * Register the Telegram webhook after deploy.
 * Reads TELEGRAM_* from .dev.vars or environment, then POSTs to the Worker.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function loadDevVars() {
  const path = resolve(root, ".dev.vars");
  if (!existsSync(path)) return {};
  const env = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function readWranglerUrl() {
  try {
    const raw = readFileSync(resolve(root, "wrangler.jsonc"), "utf8");
    const match = /"WORKER_PUBLIC_URL"\s*:\s*"([^"]+)"/.exec(raw);
    return match?.[1]?.replace(/\/$/, "");
  } catch {
    return undefined;
  }
}

const fileEnv = loadDevVars();
const secret = process.env.TELEGRAM_WEBHOOK_SECRET ?? fileEnv.TELEGRAM_WEBHOOK_SECRET;
const publicUrl = process.env.WORKER_PUBLIC_URL ?? fileEnv.WORKER_PUBLIC_URL ?? readWranglerUrl();

if (!publicUrl) {
  console.warn("[telegram] WORKER_PUBLIC_URL not set — skipping webhook setup");
  process.exit(0);
}

if (!secret) {
  console.warn(
    "[telegram] TELEGRAM_WEBHOOK_SECRET not in env/.dev.vars — cron will register webhook within 1 hour",
  );
  process.exit(0);
}

const res = await fetch(`${publicUrl}/api/telegram/ensure-webhook`, {
  method: "POST",
  headers: { "X-Telegram-Setup-Token": secret },
});

const body = await res.json().catch(() => ({}));
if (res.ok && body.ok) {
  console.log(`[telegram] webhook ${body.action}: ${body.webhookUrl ?? publicUrl + "/api/telegram/webhook"}`);
  process.exit(0);
}

console.error("[telegram] webhook setup failed:", body.detail ?? body.error ?? res.statusText);
process.exit(res.ok ? 0 : 1);
