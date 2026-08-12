import { supabase } from "@/integrations/supabase/client";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to import questions.");
  return { Authorization: `Bearer ${token}` };
}

/**
 * Extracts SAT questions from one page image via Gemini (`/api/import/vision`).
 *
 * Drop-in replacement for the former OpenRouter `askWithImage` call in vision.ts.
 */
export async function extractPageWithGemini(
  imageDataUrl: string,
  opts: { signal?: AbortSignal } = {},
): Promise<string> {
  const response = await fetch("/api/import/vision", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({ imageDataUrl }),
  });

  const data = (await response.json().catch(() => null)) as {
    content?: string;
    error?: string;
  } | null;

  if (!response.ok) {
    throw new Error(data?.error ?? "Question import vision is unavailable.");
  }

  return data?.content ?? "";
}
