import { supabase } from "@/integrations/supabase/client";

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in to import questions.");
  return { Authorization: `Bearer ${token}` };
}

export type VisionClientStage = "extract" | "recheck";

/**
 * Calls `/api/import/vision` for stage-1 extract or stage-2 recheck.
 */
export async function extractPageWithGemini(
  imageDataUrl: string,
  opts: {
    signal?: AbortSignal;
    stage?: VisionClientStage;
    priorExtraction?: string;
  } = {},
): Promise<string> {
  const response = await fetch("/api/import/vision", {
    method: "POST",
    headers: { "content-type": "application/json", ...(await authHeader()) },
    signal: opts.signal,
    body: JSON.stringify({
      imageDataUrl,
      stage: opts.stage ?? "extract",
      priorExtraction: opts.priorExtraction,
    }),
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
