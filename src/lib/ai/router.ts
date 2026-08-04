import { buildSystemPrompt } from "./prompts";

/**
 * Task → model routing for the Beyond AI proxy (master_plan.md §5A).
 *
 * Deliberately pure: this module maps a task to a model, validates the incoming
 * message list, and builds the OpenRouter request body. It performs no I/O, so
 * the routing rules and the guardrail composition can be unit-tested without a
 * network or a Worker runtime.
 */

/**
 * `quick` exists because the dashboard panel is on the critical path of the first
 * screen a student sees. A reasoning model there costs 10-30s before the first
 * token, which reads as a broken widget; this route trades depth for latency.
 */
export type AiTask = "chat" | "quick" | "reasoning" | "vision";

/**
 * Fallbacks only. The live values come from `app_settings` so a withdrawn or
 * rate-limited free model is an admin settings change rather than a redeploy —
 * OpenRouter's free tier changes without notice.
 */
export const DEFAULT_MODELS: Record<AiTask, string> = {
  chat: "meta-llama/llama-3.3-70b-instruct:free",
  quick: "meta-llama/llama-3.2-3b-instruct:free",
  reasoning: "deepseek/deepseek-chat-v3.1:free",
  vision: "google/gemini-2.0-flash-exp:free",
};

/** The `app_settings` key holding the override for each task. */
export const MODEL_SETTING_KEYS: Record<AiTask, string> = {
  chat: "openrouter_model_chat",
  quick: "openrouter_model_quick",
  reasoning: "openrouter_model_reasoning",
  vision: "openrouter_model_vision",
};

/** Upper bound on generated tokens, per task. Reasoning needs the most room. */
const MAX_TOKENS: Record<AiTask, number> = {
  chat: 1200,
  // Capped hard rather than trusted to the prompt: the dashboard panel has a
  // fixed height, and a model that ignores "be brief" would overflow it.
  quick: 400,
  reasoning: 2400,
  vision: 1600,
};

/**
 * Lower temperature for maths than for conversation. A tutor inventing a
 * plausible-looking wrong step is worse than a dry one, so reasoning runs close
 * to deterministic.
 */
const TEMPERATURE: Record<AiTask, number> = {
  chat: 0.6,
  quick: 0.5,
  reasoning: 0.2,
  vision: 0.3,
};

/** OpenRouter accepts either a plain string or the multimodal content array. */
export type AiContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export type AiMessage = {
  role: "user" | "assistant";
  content: string | AiContentPart[];
};

export type AiChatRequest = {
  task?: string;
  messages?: unknown;
  stream?: boolean;
};

/** Guards against unbounded context growth — and unbounded cost. */
const MAX_MESSAGES = 24;
const MAX_CHARS_PER_MESSAGE = 8000;

export function isAiTask(value: unknown): value is AiTask {
  return value === "chat" || value === "quick" || value === "reasoning" || value === "vision";
}

/** Falls back to `chat` rather than erroring: the cheapest, fastest route. */
export function resolveTask(value: unknown): AiTask {
  return isAiTask(value) ? value : "chat";
}

export function resolveModel(task: AiTask, overrides: Record<string, string | null | undefined>): string {
  const override = overrides[MODEL_SETTING_KEYS[task]];
  // An empty-string setting means "unset" — the admin form saves "" when a field
  // is cleared, and sending that to OpenRouter would be a 400.
  return override && override.trim() ? override.trim() : DEFAULT_MODELS[task];
}

/**
 * Validates and normalises the client's message list.
 *
 * Anything the client sends is untrusted, including the roles: a `system` role
 * arriving from the browser would let a student overwrite the guardrails, so
 * only `user` and `assistant` survive and the system prompt is added
 * server-side in `buildRequestBody`.
 */
export function normalizeMessages(input: unknown): { messages: AiMessage[] } | { error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { error: "messages must be a non-empty array" };
  }
  if (input.length > MAX_MESSAGES) {
    return { error: `messages must contain at most ${MAX_MESSAGES} entries` };
  }

  const messages: AiMessage[] = [];
  for (const raw of input) {
    if (!raw || typeof raw !== "object") return { error: "each message must be an object" };
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") {
      return { error: "message role must be 'user' or 'assistant'" };
    }

    if (typeof content === "string") {
      if (!content.trim()) return { error: "message content must not be empty" };
      if (content.length > MAX_CHARS_PER_MESSAGE) {
        return { error: `message content must be under ${MAX_CHARS_PER_MESSAGE} characters` };
      }
      messages.push({ role, content });
      continue;
    }

    if (Array.isArray(content)) {
      const parts = normalizeParts(content);
      if ("error" in parts) return parts;
      messages.push({ role, content: parts.parts });
      continue;
    }

    return { error: "message content must be a string or a content-part array" };
  }

  // OpenRouter rejects a conversation that doesn't end on a user turn, and it's
  // a sign the client is out of sync rather than something to paper over.
  if (messages[messages.length - 1].role !== "user") {
    return { error: "the final message must be from the user" };
  }

  return { messages };
}

function normalizeParts(content: unknown[]): { parts: AiContentPart[] } | { error: string } {
  if (content.length === 0) return { error: "message content array must not be empty" };
  const parts: AiContentPart[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") return { error: "each content part must be an object" };
    const part = raw as { type?: unknown; text?: unknown; image_url?: unknown };

    if (part.type === "text") {
      if (typeof part.text !== "string" || !part.text.trim()) {
        return { error: "text parts require a non-empty 'text' string" };
      }
      if (part.text.length > MAX_CHARS_PER_MESSAGE) {
        return { error: `message content must be under ${MAX_CHARS_PER_MESSAGE} characters` };
      }
      parts.push({ type: "text", text: part.text });
      continue;
    }

    if (part.type === "image_url") {
      const url = (part.image_url as { url?: unknown } | undefined)?.url;
      if (typeof url !== "string" || !url) {
        return { error: "image parts require 'image_url.url'" };
      }
      /* Only data URLs and https are accepted. An arbitrary URL would make the
         Worker fetch whatever a client names, on the platform's credentials —
         a server-side request forgery vector, not a feature. */
      if (!/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(url) && !/^https:\/\//i.test(url)) {
        return { error: "image_url must be an https URL or a base64 image data URL" };
      }
      parts.push({ type: "image_url", image_url: { url } });
      continue;
    }

    return { error: "content part type must be 'text' or 'image_url'" };
  }
  return { parts };
}

export type OpenRouterBody = {
  model: string;
  messages: ({ role: "system"; content: string } | AiMessage)[];
  temperature: number;
  max_tokens: number;
  stream: boolean;
};

/**
 * Builds the OpenRouter payload. The system prompt is prepended here, in the one
 * place every route passes through, which is what guarantees the guardrails are
 * present on every call.
 */
export function buildRequestBody(
  task: AiTask,
  messages: AiMessage[],
  model: string,
  stream: boolean,
): OpenRouterBody {
  return {
    model,
    messages: [{ role: "system", content: buildSystemPrompt(task) }, ...messages],
    temperature: TEMPERATURE[task],
    max_tokens: MAX_TOKENS[task],
    stream,
  };
}
