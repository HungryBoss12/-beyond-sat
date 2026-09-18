import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";
import { handleAiChat } from "./lib/ai/handler";
import { handleUinfoFlush } from "./lib/uinfo/summarize";
import { handleYoutubeRecs } from "./lib/youtube/search";
import { handleImportVision } from "./lib/import/vision-handler";
import { handleImportFix } from "./lib/import/fix-handler";
import { handleImportFigure } from "./lib/import/figure-handler";
import { handleVocabAdminSave } from "./lib/vocab/handlers/admin-save";
import { handleVocabAdminCard, handleVocabAdminDeck } from "./lib/vocab/handlers/admin-decks";
import { handleVocabGenerate } from "./lib/vocab/handlers/generate";
import { handleVocabQuizSubmit } from "./lib/vocab/handlers/quiz-submit";
import { handleVocabReview, handleVocabSession } from "./lib/vocab/handlers/session";
import { handleAdminCreateUser } from "./lib/auth/create-user-handler";
import { handleCompleteFirstLogin } from "./lib/auth/complete-first-login-handler";
import { handleUsernameLogin } from "./lib/auth/username-login-handler";
import { handleEnsureTelegramWebhook } from "./lib/telegram/ensure-webhook-handler";
import { handleTelegramWebhook } from "./lib/telegram/webhook";
import { ensureTelegramWebhook } from "./lib/telegram/webhook-setup";
import { checkMaintenance } from "./lib/maintenance";
import { maintenanceResponse } from "./lib/maintenance-page";
import { applySecurityHeaders } from "./lib/security-headers";

/* Load .dev.vars/.env.local/.env into process.env for `vite dev`.
   This is dead code on the edge — the `if (import.meta.env.DEV)` literal is
   substituted at build time so Rollup drops the entire branch, including the
   import("node:fs") call that would otherwise pull a Node builtin into the
   Worker. */
if (import.meta.env.DEV) {
  const { loadDevEnv } = await import("./lib/dev-env");
  await loadDevEnv();
}

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;
let webhookEnsureStarted = false;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

/**
 * This wrapper is the app's only server-side interception point. `@tanstack/
 * react-start` 1.168.32 has no `createServerRoute` export — only
 * `createServerFn`, which is RPC-shaped and can't stream SSE or return a 503 for
 * a document request. vite.config.ts already redirects the server entry here, so
 * both concerns hang off this `fetch` rather than fighting the router.
 *
 * Order matters: the AI route is handled before the maintenance gate, because
 * `/api/*` is exempt from maintenance anyway and checking first would add a DB
 * round trip to every chat token.
 */
export default {
  async scheduled(_event: unknown, env: unknown, ctx: { waitUntil: (p: Promise<unknown>) => void }) {
    ctx.waitUntil(
      ensureTelegramWebhook(env).then((result) => {
        if (!result.ok && result.action !== "skipped") {
          console.error("[telegram] scheduled webhook ensure failed", result);
        } else {
          console.log("[telegram] scheduled webhook ensure", result.action);
        }
      }),
    );
  },

  async fetch(request: Request, env: unknown, ctx: unknown) {
    const waitUntil =
      ctx && typeof ctx === "object" && "waitUntil" in ctx
        ? (ctx as { waitUntil: (p: Promise<unknown>) => void }).waitUntil
        : undefined;

    if (!webhookEnsureStarted && waitUntil) {
      webhookEnsureStarted = true;
      waitUntil(
        ensureTelegramWebhook(env, request.url).then((result) => {
          if (result.action === "registered" || result.action === "updated") {
            console.log("[telegram] auto webhook ensure", result.action, result.webhookUrl);
          }
        }),
      );
    }

    try {
      const url = new URL(request.url);

      if (url.pathname === "/api/ai/chat") {
        return applySecurityHeaders(await handleAiChat(request, env), env);
      }

      if (url.pathname === "/api/ai/uinfo") {
        return applySecurityHeaders(await handleUinfoFlush(request, env), env);
      }

      if (url.pathname === "/api/ai/youtube-recs") {
        return applySecurityHeaders(await handleYoutubeRecs(request, env), env);
      }

      if (url.pathname === "/api/import/vision") {
        return applySecurityHeaders(await handleImportVision(request, env), env);
      }

      if (url.pathname === "/api/import/fix") {
        return applySecurityHeaders(await handleImportFix(request, env), env);
      }

      if (url.pathname === "/api/import/figure") {
        return applySecurityHeaders(await handleImportFigure(request, env), env);
      }

      if (url.pathname === "/api/vocab/session") {
        return applySecurityHeaders(await handleVocabSession(request, env), env);
      }

      if (url.pathname === "/api/vocab/review") {
        return applySecurityHeaders(await handleVocabReview(request, env), env);
      }

      if (url.pathname === "/api/vocab/quiz/submit") {
        return applySecurityHeaders(await handleVocabQuizSubmit(request, env), env);
      }

      if (url.pathname === "/api/vocab/generate") {
        return applySecurityHeaders(await handleVocabGenerate(request, env), env);
      }

      if (url.pathname === "/api/vocab/admin/save") {
        return applySecurityHeaders(await handleVocabAdminSave(request, env), env);
      }

      const deckAdmin = url.pathname.match(/^\/api\/vocab\/admin\/decks\/([^/]+)$/);
      if (deckAdmin) {
        return applySecurityHeaders(
          await handleVocabAdminDeck(request, env, decodeURIComponent(deckAdmin[1])),
          env,
        );
      }

      const cardAdmin = url.pathname.match(/^\/api\/vocab\/admin\/cards\/([^/]+)$/);
      if (cardAdmin) {
        return applySecurityHeaders(
          await handleVocabAdminCard(request, env, decodeURIComponent(cardAdmin[1])),
          env,
        );
      }

      if (url.pathname === "/api/admin/create-user") {
        return applySecurityHeaders(await handleAdminCreateUser(request, env), env);
      }

      if (url.pathname === "/api/auth/username-login") {
        return applySecurityHeaders(await handleUsernameLogin(request, env), env);
      }

      if (url.pathname === "/api/auth/complete-first-login") {
        return applySecurityHeaders(await handleCompleteFirstLogin(request, env), env);
      }

      if (url.pathname === "/api/telegram/webhook") {
        return applySecurityHeaders(await handleTelegramWebhook(request, env), env);
      }

      if (url.pathname === "/api/telegram/ensure-webhook") {
        return applySecurityHeaders(await handleEnsureTelegramWebhook(request, env), env);
      }

      const maintenance = await checkMaintenance(request, env, Date.now());
      if (maintenance) {
        return maintenanceResponse(maintenance.message);
      }

      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return applySecurityHeaders(await normalizeCatastrophicSsrResponse(response), env);
    } catch (error) {
      console.error(error);
      return applySecurityHeaders(
        new Response(renderErrorPage(), {
          status: 500,
          headers: { "content-type": "text/html; charset=utf-8" },
        }),
        env,
      );
    }
  },
};
