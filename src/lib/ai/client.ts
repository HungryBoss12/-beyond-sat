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
export type ChatMessage = { role: ChatRole; content: string };
/** Mirrors `AiTask` in src/lib/ai/router.ts — the server rejects anything else. */
export type AiTask = "chat" | "quick" | "reasoning" | "vision";

type StreamOptions = {
  messages: ChatMessage[];
  task?: AiTask;
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

export async function streamChat({ messages, task = "chat", signal, onToken }: StreamOptions) {
  const response = await fetch("/api/ai/chat", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    body: JSON.stringify({ task, messages, stream: true }),
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

/**
 * Conversation state plus the streaming call. Kept as a hook so the analysis
 * chat and the dashboard's one-shot recommendation card share exactly one
 * implementation of the request, the abort handling, and the error mapping.
 */
export function useBeyondAi(task: AiTask = "chat") {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // An in-flight stream outliving its component would keep writing to unmounted
  // state and hold the connection open.
  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setError(null);
      setStreaming(true);

      // Snapshot before the assistant placeholder is appended — the request must
      // carry the user turns only, and setState is async.
      const history = [...messages, { role: "user" as const, content: trimmed }];
      setMessages([...history, { role: "assistant", content: "" }]);

      try {
        await streamChat({
          messages: history,
          task,
          signal: controller.signal,
          onToken: (delta) =>
            setMessages((current) => {
              const next = [...current];
              const last = next[next.length - 1];
              if (last?.role === "assistant") {
                next[next.length - 1] = { ...last, content: last.content + delta };
              }
              return next;
            }),
        });
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        setError((err as Error)?.message ?? "Something went wrong.");
        // Drop the empty placeholder so the transcript doesn't keep a blank turn.
        setMessages((current) =>
          current[current.length - 1]?.role === "assistant" &&
          !current[current.length - 1].content
            ? current.slice(0, -1)
            : current,
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        setStreaming(false);
      }
    },
    [messages, streaming, task],
  );

  const reset = useCallback(() => {
    stop();
    setMessages([]);
    setError(null);
  }, [stop]);

  return { messages, streaming, error, send, stop, reset };
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
