import { locateFiguresOnPage, type FigureStage } from "@/lib/gemini/locate-figure";
import { GeminiError } from "@/lib/gemini/errors";
import { readBearerToken, readEnv, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type FigureRequest = {
  imageDataUrl?: unknown;
  stage?: unknown;
  priorLocation?: unknown;
  hint?: unknown;
};

/**
 * POST /api/import/figure — two-stage Gemini figure location for admin import.
 */
export async function handleImportFigure(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) {
    console.error("[import/figure] Supabase env missing; cannot authenticate requests");
    return json({ error: "Server is not configured" }, 500);
  }

  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "Sign in to attach figures" }, 401);
  }

  const user = await verifySupabaseUser(config, token);
  if (!user) {
    return json({ error: "Your session has expired. Sign in again." }, 401);
  }

  let payload: FigureRequest;
  try {
    payload = (await request.json()) as FigureRequest;
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  if (typeof payload.imageDataUrl !== "string" || !payload.imageDataUrl.trim()) {
    return json({ error: "imageDataUrl is required" }, 400);
  }

  const stage: FigureStage = payload.stage === "recheck" ? "recheck" : "extract";
  const priorLocation =
    typeof payload.priorLocation === "string" ? payload.priorLocation : undefined;
  const hint = typeof payload.hint === "string" ? payload.hint : undefined;

  if (stage === "recheck" && !priorLocation?.trim()) {
    return json({ error: "priorLocation is required for recheck" }, 400);
  }

  const apiKey =
    stage === "recheck" ? readEnv(env, "OPENROUTER_API_KEY") : readEnv(env, "GEMINI_API_KEY");
  if (!apiKey) {
    console.error(
      import.meta.env.DEV
        ? `[import/figure] ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"} is not set — add it to .dev.vars or .env.local, then restart the dev server.`
        : `[import/figure] ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"} is not set — run: npx wrangler secret put ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"}`,
    );
    return json(
      {
        error:
          stage === "recheck"
            ? "Figure recheck is not available right now."
            : "Figure attach is not available right now.",
      },
      503,
    );
  }

  try {
    const content = await locateFiguresOnPage(
      typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "",
      {
        apiKey,
        stage,
        priorLocation,
        hint,
      },
    );
    return json({ content, stage }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("[import/figure] unexpected failure", error);
    return json({ error: "Failed to locate figures on this page." }, 500);
  }
}
