import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Client for the `/api/ai/chat` proxy.
 *
 * The transport is SSE in OpenAI's streaming format: `data: {json}` lines
 * terminated by `data: [DONE]`. This decodes them incrementally and hands each
 * content delta to `onToken`, so the UI can paint a partial answer rather than
 * waiting for a reasoning model to finish — which can take fifteen seconds.
 */

export type ChatRole = "user" | "assistant";

/** Mirrors `AiContentPart` in src/lib/ai/router.ts — the wire format for attachments. */
export type AiContentPart =
  { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } };

/**
 * `content` is a plain string for every text-only turn and a part array only when
 * the turn carries an image. Consumers that want the words should call
 * `messageText` rather than branching on the type at each call site — a
 * `content.replace(...)` on an array is a runtime error, not a type error, the
 * moment an `any` sneaks in.
 */
export type ChatMessage = { role: ChatRole; content: string | AiContentPart[] };

/** Mirrors `AiTask` in src/lib/ai/router.ts — the server rejects anything else. */
export type AiTask = "chat" | "quick" | "reasoning" | "vision";

/** Mirrors `AiSurface` in router.ts: decides the token ceiling, nothing else. */
export type AiSurface = "panel" | "page";

/** The text of a turn, whether or not it carries an attachment. */
export function messageText(content: string | AiContentPart[]): string {
  if (typeof content === "string") return content;
  return content
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("\n");
}

/** The attached image of a turn, or null. */
export function messageImage(content: string | AiContentPart[]): string | null {
  if (typeof content === "string") return null;
  const part = content.find((entry) => entry.type === "image_url");
  return part && part.type === "image_url" ? part.image_url.url : null;
}

/** Builds the two-part payload `normalizeParts` already accepts server-side. */
export function buildImageContent(text: string, imageDataUrl: string): AiContentPart[] {
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: imageDataUrl } },
  ];
}

type StreamOptions = {
  messages: ChatMessage[];
  task?: AiTask;
  /** A `CHAT_MODELS` slug. The server allowlists it; a raw model ID is refused. */
  model?: string;
  surface?: AiSurface;
  signal?: AbortSignal;
  onToken: (delta: string) => void;
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to use Beyond AI.");
  return { Authorization: `Bearer ${token}` };
}

/** Pulls the assistant's text out of one SSE `data:` payload. */
function readDelta(payload: string): string {
  try {
    const parsed = JSON.parse(payload) as {
      choices?: { delta?: { content?: unknown }; message?: { content?: unknown } }[];
    };
    const choice = parsed.choices?.[0];
    const delta = choice?.delta?.content ?? choice?.message?.content;
    return typeof delta === "string" ? delta : "";
  } catch {
    // A partial JSON chunk is normal mid-stream; the next read completes it.
    return "";
  }
}

export async function streamChat({
  messages,
  task = "chat",
  model,
  surface,
  signal,
  onToken,
}: StreamOptions) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ task, model, surface, messages, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error ?? "Beyond AI couldn't answer that. Try again.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    /* Split on the last newline only. A chunk can end mid-line, so the tail is
       kept in the buffer and completed by the next read. */
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      const delta = readDelta(payload);
      if (delta) onToken(delta);
    }
  }
}

export type UseBeyondAiOptions = {
  task?: AiTask;
  /** A `CHAT_MODELS` slug from the picker; overrides `task` server-side. */
  model?: string;
  surface?: AiSurface;
  /**
   * Fires once a turn has finished streaming, with both halves of it. The chat
   * page uses this to persist the pair — reading `messages` after `await send()`
   * would see the closure's stale snapshot.
   */
  onTurn?: (turn: { user: ChatMessage; assistant: string }) => void;
};

export type SendOptions = {
  /** A `data:image/...;base64,` URL. Sent inline; the server validates the shape. */
  imageDataUrl?: string;
  /** Overrides the hook's slug for this turn — the picker can move mid-chat. */
  model?: string;
};

/**
 * Conversation state plus the streaming call. Kept as a hook so the analysis
 * chat and the dashboard's one-shot recommendation card share exactly one
 * implementation of the request, the abort handling, and the error mapping.
 */
export function useBeyondAi(config: AiTask | UseBeyondAiOptions = "chat") {
  const options = typeof config === "string" ? { task: config } : config;
  const { task, model, surface } = options;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Held in a ref so a caller can persist a finished turn without the callback
  // identity re-creating `send` on every render.
  const onTurnRef = useRef(options.onTurn);
  onTurnRef.current = options.onTurn;

  // An in-flight stream outliving its component would keep writing to unmounted
  // state and hold the connection open.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string, sendOptions: SendOptions = {}) => {
      const trimmed = text.trim();
      // An image on its own is a valid turn; the prompt is filled in for it so the
      // model has something to answer rather than an empty text part, which the
      // server rejects.
      if (streaming) return;
      if (!trimmed && !sendOptions.imageDataUrl) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStreaming(true);

      const prompt = trimmed || "Help me with the question in this image.";
      const userTurn: ChatMessage = {
        role: "user",
        content: sendOptions.imageDataUrl
          ? buildImageContent(prompt, sendOptions.imageDataUrl)
          : prompt,
      };

      // Snapshot before the assistant placeholder is appended — the request must
      // carry the user turns only, and setState is async.
      const history = [...messages, userTurn];
      setMessages([...history, { role: "assistant", content: "" }]);

      let answer = "";
      try {
        await streamChat({
          messages: history,
          task,
          model: sendOptions.model ?? model,
          surface,
          signal: controller.signal,
          onToken: (delta) => {
            answer += delta;
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: messageText(last.content) + delta };
              }
              return next;
            });
          },
        });
        onTurnRef.current?.({ user: userTurn, assistant: answer });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Something went wrong.");
        // Drop the empty placeholder so the transcript doesn't keep a blank turn.
        setMessages((current) =>
          current[current.length - 1]?.role === "assistant" &&
          !messageText(current[current.length - 1].content)
            ? current.slice(0, -1)
            : current,
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [messages, streaming, task, model, surface],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  /** Swaps the whole transcript in — used when a stored conversation is opened. */
  const load = useCallback(
    (next: ChatMessage[]) => {
      stop();
      setMessages(next);
      setError(null);
    },
    [stop],
  );

  return { messages, streaming, error, send, stop, reset, load };
}

/**
 * One-shot, non-streaming call. Used by the dashboard recommendation card, which
 * wants a single short paragraph and has nowhere sensible to show a cursor.
 */
export async function askOnce(prompt: string, task: AiTask = "chat"): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ task, stream: false, messages: [{ role: "user", content: prompt }] }),
  });
  const data = (await response.json()) as { content?: string; error?: string };
  if (!response.ok) throw new Error(data.error ?? "Beyond AI is unavailable.");
  return data.content ?? "";
}

/**
 * One-shot call with an image attached, for the scanned-document import path.
 *
 * Non-streaming on purpose: the caller wants a complete JSON array to parse, and
 * a half-received array is not a partial result, it's a syntax error. `signal` is
 * required in practice rather than optional — a 108-page run has to be
 * interruptible, and the abort has to reach the in-flight page, not just stop the
 * loop after it.
 *
 * `imageDataUrl` must be a `data:image/...;base64,` URL. `normalizeParts` in
 * router.ts enforces that server-side: an arbitrary URL would make the Worker
 * fetch whatever the client names, on the platform's credentials.
 */
export async function askWithImage(
  prompt: string,
  imageDataUrl: string,
  opts: { task?: AiTask; signal?: AbortSignal } = {},
): Promise<string> {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({
      task: opts.task ?? "vision",
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });
  const data = (await response.json().catch(() => null)) as {
    content?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(data?.error ?? "Beyond AI is unavailable.");
  return data?.content ?? "";
}
