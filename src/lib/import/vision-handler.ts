import { extractSatPageFromImage } from "@/lib/gemini/extract-page";
import { GeminiError } from "@/lib/gemini/errors";
import { readBearerToken, readEnv, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type VisionRequest = {
  imageDataUrl?: unknown;
};

/**
 * POST /api/import/vision — Gemini-backed SAT page extraction for admin import.
 *
 * Replaces the former OpenRouter vision path so test imports use Google AI Studio
 * directly via `GEMINI_API_KEY`.
 */
export async function handleImportVision(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) {
    console.error("[import/vision] Supabase env missing; cannot authenticate requests");
    return json({ error: "Server is not configured" }, 500);
  }

  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "Sign in to import questions" }, 401);
  }

  const user = await verifySupabaseUser(config, token);
  if (!user) {
    return json({ error: "Your session has expired. Sign in again." }, 401);
  }

  const apiKey = readEnv(env, "GEMINI_API_KEY");
  if (!apiKey) {
    console.error(
      import.meta.env.DEV
        ? "[import/vision] GEMINI_API_KEY is not set — add it to .dev.vars or .env.local, then restart the dev server."
        : "[import/vision] GEMINI_API_KEY is not set — run: npx wrangler secret put GEMINI_API_KEY",
    );
    return json({ error: "Question import vision is not available right now." }, 503);
  }

  let payload: VisionRequest;
  try {
    payload = (await request.json()) as VisionRequest;
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  if (typeof payload.imageDataUrl !== "string" || !payload.imageDataUrl.trim()) {
    return json({ error: "imageDataUrl is required" }, 400);
  }

  try {
    const content = await extractSatPageFromImage(payload.imageDataUrl, { apiKey });
    return json({ content }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("[import/vision] unexpected failure", error);
    return json({ error: "Failed to extract questions from this page." }, 500);
  }
}
