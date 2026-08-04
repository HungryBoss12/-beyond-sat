import {
  buildRequestBody,
  normalizeMessages,
  resolveModel,
  resolveTask,
  type AiChatRequest,
} from "./router";
import {
  callRpc,
  readBearerToken,
  readEnv,
  readSupabaseConfig,
  verifySupabaseUser,
} from "../server-env";

/**
 * The `/api/ai/chat` endpoint (master_plan.md §5A).
 *
 * This is a proxy, not a client: the OpenRouter key lives only in the Worker's
 * secret store, so the browser never holds it and the request cannot be replayed
 * against OpenRouter directly. Every request is authenticated first — an
 * unauthenticated caller must never cause a billable upstream call.
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/auth/key";

/**
 * Describes a credential without printing it: length and the non-secret prefix
 * only. Enough to tell "the Worker is holding a truncated paste" or "the Worker
 * is still holding the old key" apart from "the value looks right", which is
 * otherwise unanswerable from outside the deployment.
 */
function describeKey(key: string): string {
  return `length ${key.length}, prefix ${JSON.stringify(key.slice(0, 8))}`;
}

/**
 * Asks OpenRouter whether a key resolves to an account at all.
 *
 * `/auth/key` is the one endpoint that answers "is this credential valid?"
 * without generating tokens, and it's the only way to split the two causes of a
 * 401 apart. OpenRouter answers a malformed *or* unknown credential with the
 * same `"User not found."` body, so the message alone can't distinguish a
 * revoked key from a valid key sent in a request it rejected for another reason
 * — a distinction that decides whether rotating the key again is even worth
 * doing. Only called on the 401 path, so it costs nothing in the normal case.
 */
async function probeKey(apiKey: string): Promise<string> {
  try {
    const response = await fetch(OPENROUTER_KEY_URL, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (response.ok) {
      return (
        "BUT /auth/key ACCEPTED the same key, so the credential is valid and the " +
        "rejection is about this request, not the key. Rotating it again will not help. " +
        "Most likely the key lacks inference scope (an OpenRouter *provisioning* key " +
        "cannot call /chat/completions) or the account has not accepted the data policy " +
        "required for :free models at https://openrouter.ai/settings/privacy"
      );
    }
    return (
      `and /auth/key rejected it too (${response.status}), so this credential genuinely ` +
      "does not resolve to an OpenRouter account. The value the Worker is running with is " +
      "not the key you created — check you set it on the Worker actually serving traffic " +
      "(beyond-sat-v0) and that the whole value was pasted."
    );
  } catch {
    return "and /auth/key could not be reached, so the key itself could not be checked.";
  }
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

/**
 * Model IDs come from `app_settings`, which is admin-only for SELECT, so this
 * goes through a `SECURITY DEFINER` function that exposes exactly the three
 * model keys to any signed-in user. A null result means the migration hasn't
 * been applied yet — the router falls back to its defaults rather than failing.
 */
async function loadModelOverrides(
  config: { url: string; anonKey: string },
  token: string,
): Promise<Record<string, string>> {
  const rows = await callRpc<{ key: string; value: string | null }[]>(
    config,
    "get_ai_models",
    token,
  );
  if (!Array.isArray(rows)) return {};
  const overrides: Record<string, string> = {};
  for (const row of rows) {
    if (row && typeof row.key === "string" && typeof row.value === "string") {
      overrides[row.key] = row.value;
    }
  }
  return overrides;
}

export async function handleAiChat(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) {
    console.error("[ai] Supabase env missing; cannot authenticate requests");
    return json({ error: "Server is not configured" }, 500);
  }

  // Auth before anything else — cheapest possible rejection for the case that
  // matters most, and it keeps unauthenticated traffic away from OpenRouter.
  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "Sign in to use Beyond AI" }, 401);
  }
  const user = await verifySupabaseUser(config, token);
  if (!user) {
    return json({ error: "Your session has expired. Sign in again." }, 401);
  }

  const apiKey = readEnv(env, "OPENROUTER_API_KEY");
  if (!apiKey) {
    /* Deliberately explicit in the log and vague to the client: an admin needs
       to know the secret is missing, a student doesn't need the internals. */
    console.error("[ai] OPENROUTER_API_KEY is not set — run: wrangler secret put OPENROUTER_API_KEY");
    return json({ error: "Beyond AI isn't available right now." }, 503);
  }

  let payload: AiChatRequest;
  try {
    payload = (await request.json()) as AiChatRequest;
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  const normalized = normalizeMessages(payload.messages);
  if ("error" in normalized) {
    return json({ error: normalized.error }, 400);
  }

  const task = resolveTask(payload.task);
  const stream = payload.stream !== false;
  const overrides = await loadModelOverrides(config, token);
  const model = resolveModel(task, overrides);
  const body = buildRequestBody(task, normalized.messages, model, stream);

  let upstream: Response;
  try {
    upstream = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        // OpenRouter uses these for attribution on the model leaderboards.
        "HTTP-Referer": "https://beyondsat.app",
        "X-Title": "Beyond SAT",
      },
      body: JSON.stringify(body),
    });
  } catch (error) {
    console.error("[ai] upstream request failed", error);
    return json({ error: "Beyond AI couldn't be reached. Try again." }, 502);
  }

  if (!upstream.ok) {
    /* The upstream error text can name the provider and the model, which the
       identity guardrail exists to prevent leaking — so it goes to the log and
       the client gets a generic message keyed to the status. */
    const detail = await upstream.text().catch(() => "");
    console.error(`[ai] openrouter ${upstream.status} for model ${model}: ${detail.slice(0, 500)}`);

    /* 401 from OpenRouter is about the credential, never the model. Its body
       reads "User not found." for BOTH an unknown key and a valid key it
       declined to use, so the message on its own is misleading — it points at a
       dead account when the account may be fine. `probeKey` resolves which one
       it is, and the shape line catches the common case of the Worker still
       holding a stale or truncated value. */
    if (upstream.status === 401) {
      const verdict = await probeKey(apiKey);
      console.error(
        `[ai] OpenRouter rejected the key on /chat/completions (${describeKey(apiKey)}) ${verdict}`,
      );
      return json({ error: "Beyond AI isn't configured correctly. Please contact an admin." }, 503);
    }

    // 402 = the account is out of credit. Free models still need a funded or
    // verified account, so this is also an admin problem, not a student one.
    if (upstream.status === 402) {
      console.error("[ai] OpenRouter reports insufficient credit for this account.");
      return json({ error: "Beyond AI is unavailable right now. Please contact an admin." }, 503);
    }

    // 404 means the configured model ID no longer exists — free models get
    // withdrawn without notice, which is the exact reason the IDs are settings.
    if (upstream.status === 404) {
      console.error(
        `[ai] model "${model}" was not found upstream. Update it at /admin/settings.`,
      );
      return json({ error: "Beyond AI is unavailable right now. Please contact an admin." }, 503);
    }

    if (upstream.status === 429) {
      return json({ error: "Beyond AI is busy right now. Try again in a moment." }, 429);
    }
    return json({ error: "Beyond AI couldn't answer that. Try again." }, 502);
  }

  if (!stream) {
    const data = (await upstream.json()) as {
      choices?: { message?: { content?: unknown } }[];
    };
    const content = data.choices?.[0]?.message?.content;
    return json({ content: typeof content === "string" ? content : "" }, 200);
  }

  /* SSE passes straight through: Workers stream a `ReadableStream` body without
     buffering it, so there's nothing to re-chunk. `X-Accel-Buffering: no` stops
     any intermediate proxy from collecting the whole response first, which would
     turn the stream into a single delayed blob. */
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
