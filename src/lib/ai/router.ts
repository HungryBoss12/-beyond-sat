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
 *
 * Vision uses the Gemini API directly (`gemini-3-flash-preview`), not OpenRouter.
 */
export const DEFAULT_MODELS: Record<AiTask, string> = {
  chat: "nvidia/nemotron-3-super-120b-a12b:free",
  // Nano `:free` was withdrawn on OpenRouter (404 → paid-only). Use the free
  // auto-router until another stable free nano-class ID exists.
  quick: "openrouter/free",
  reasoning: "nvidia/nemotron-3-ultra-550b-a55b:free",
  vision: "gemini-3-flash-preview",
};

/**
 * OpenRouter IDs that no longer resolve — usually from an old MAINTENANCE_MODE.sql
 * seed. Falling back to DEFAULT_MODELS keeps chat working until an admin updates
 * /admin/settings or the SQL migration is re-run.
 */
const WITHDRAWN_OPENROUTER_MODELS = new Set([
  "meta-llama/llama-3.3-70b-instruct:free",
  "meta-llama/llama-3.2-3b-instruct:free",
  "deepseek/deepseek-chat-v3.1:free",
  "deepseek/deepseek-r1:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-flash-001",
  "nvidia/nemotron-3-nano-30b-a3b:free",
]);

/** The `app_settings` key holding the override for each task. */
export const MODEL_SETTING_KEYS: Record<AiTask, string> = {
  chat: "openrouter_model_chat",
  quick: "openrouter_model_quick",
  reasoning: "openrouter_model_reasoning",
  vision: "openrouter_model_vision",
};

/**
 * The student-facing model picker.
 *
 * The client sends a slug from this table and never a model ID. That is the whole
 * point: an endpoint that accepted `model` verbatim would let any signed-in
 * student bill the platform against any model on OpenRouter. Each slug resolves
 * through the existing `resolveModel(task, overrides)`, so the `/admin/settings`
 * override still wins and a withdrawn `:free` model stays a settings change.
 *
 * The nicknames are the only names a student ever sees; `IDENTITY_RULE` in
 * prompts.ts separately forbids the model from naming its own backend.
 */
export const CHAT_MODELS = {
  "beyonder-2-0": { label: "Beyonder 2.0", hint: "balanced", task: "chat" },
  "beyonder-2-0-flashy": { label: "Beyonder 2.0 Flashy", hint: "fastest", task: "quick" },
  "beyonder-2-1-think": {
    label: "Beyonder 2.1 Think",
    hint: "deepest reasoning",
    task: "reasoning",
  },
} as const satisfies Record<string, { label: string; hint: string; task: AiTask }>;

export type ChatModelChoice = keyof typeof CHAT_MODELS;

export const DEFAULT_CHAT_MODEL: ChatModelChoice = "beyonder-2-0";

export const CHAT_MODEL_CHOICES = Object.entries(CHAT_MODELS).map(([slug, meta]) => ({
  slug: slug as ChatModelChoice,
  ...meta,
}));

export function isChatModelChoice(value: unknown): value is ChatModelChoice {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(CHAT_MODELS, value);
}

/** Falls back rather than erroring, matching `resolveTask`'s posture on a bad route. */
export function resolveChatModelChoice(value: unknown): ChatModelChoice {
  return isChatModelChoice(value) ? value : DEFAULT_CHAT_MODEL;
}

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
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

export type AiMessage = {
  role: "user" | "assistant";
  content: string | AiContentPart[];
};

export type AiChatRequest = {
  task?: string;
  /** A `CHAT_MODELS` slug from the picker. Takes precedence over `task`. */
  model?: string;
  /** Where the answer is rendered — see `AiSurface`. */
  surface?: string;
  messages?: unknown;
  stream?: boolean;
};

/**
 * Where the reply will be shown. This exists only to decouple the token budget
 * from the task: `quick`'s 400-token cap was written for the fixed-height
 * dashboard card, and reusing it in a full-screen chat truncates mid-sentence,
 * which reads as a broken model rather than as a cap.
 */
export type AiSurface = "panel" | "page";

export function resolveSurface(value: unknown): AiSurface {
  return value === "page" ? "page" : "panel";
}

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

export function resolveModel(
  task: AiTask,
  overrides: Record<string, string | null | undefined>,
): string {
  const override = overrides[MODEL_SETTING_KEYS[task]];
  // An empty-string setting means "unset" — the admin form saves "" when a field
  // is cleared, and sending that to OpenRouter would be a 400.
  const value = override && override.trim() ? override.trim() : DEFAULT_MODELS[task];
  if (task !== "vision" && WITHDRAWN_OPENROUTER_MODELS.has(value)) {
    return DEFAULT_MODELS[task];
  }
  return value;
}

/**
 * Resolves the Gemini model used for image recognition.
 *
 * `openrouter_model_vision` predates the Gemini-direct path and may still hold an
 * OpenRouter slug (`google/gemini-…:free`). Those IDs are invalid on the Gemini
 * SDK, so anything with a `/` is ignored and the default is used instead.
 */
export function resolveGeminiVisionModel(
  overrides: Record<string, string | null | undefined>,
): string {
  const override = overrides[MODEL_SETTING_KEYS.vision]?.trim();
  if (override && !override.includes("/")) return override;
  return DEFAULT_MODELS.vision;
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

/** True when any turn still carries an `image_url` part (before server-side enrichment). */
export function messagesContainImages(messages: AiMessage[]): boolean {
  return messages.some(
    (message) =>
      typeof message.content !== "string" &&
      message.content.some((part) => part.type === "image_url"),
  );
}

/** True when the final user turn includes an image — the only turn we re-read with Gemini. */
export function latestUserMessageHasImages(messages: AiMessage[]): boolean {
  const last = messages[messages.length - 1];
  return (
    last?.role === "user" &&
    typeof last.content !== "string" &&
    last.content.some((part) => part.type === "image_url")
  );
}

/** Keeps a turn non-empty after image parts are removed for text-only models. */
export const IMAGE_PLACEHOLDER = "[Image attached]";

/** Historical image turns after recognition — context lives in prior assistant replies. */
export const EARLIER_IMAGE_PLACEHOLDER = "[Image attached earlier in this chat]";

/**
 * Text-only OpenRouter models reject `image_url` parts. After image recognition
 * replaces figures with text, this is a safety net for any leftover attachments.
 */
export function prepareMessagesForTask(messages: AiMessage[], task: AiTask): AiMessage[] {
  if (task === "vision") return messages;
  return messages.map((message) => {
    if (typeof message.content === "string") return message;
    const text = message.content
      .filter((part): part is { type: "text"; text: string } => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();
    return { role: message.role, content: text || IMAGE_PLACEHOLDER };
  });
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
  surface: AiSurface = "panel",
): OpenRouterBody {
  return {
    model,
    messages: [{ role: "system", content: buildSystemPrompt(task) }, ...messages],
    temperature: TEMPERATURE[task],
    max_tokens: resolveMaxTokens(task, surface),
    stream,
  };
}

/**
 * The task keeps its own model and temperature everywhere; only the ceiling moves.
 * On a full page nothing overflows, so `quick` gets `chat`'s room instead of the
 * cap the dashboard card needs.
 */
export function resolveMaxTokens(task: AiTask, surface: AiSurface): number {
  if (surface === "page" && task === "quick") return MAX_TOKENS.chat;
  return MAX_TOKENS[task];
}
