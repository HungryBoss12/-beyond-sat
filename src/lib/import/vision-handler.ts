import { extractSatPageFromImage, type VisionStage } from "@/lib/gemini/extract-page";
import { GeminiError } from "@/lib/gemini/errors";
import {
  readBearerToken,
  readEnv,
  readSupabaseConfig,
  verifyStaffUser,
  verifySupabaseUser,
} from "@/lib/server-env";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type VisionRequest = {
  imageDataUrl?: unknown;
  stage?: unknown;
  priorExtraction?: unknown;
};

function missingKeyMessage(name: "GEMINI_API_KEY" | "OPENROUTER_API_KEY", route: string): string {
  return import.meta.env.DEV
    ? `[${route}] ${name} is not set — add it to .dev.vars or .env.local, then restart the dev server.`
    : `[${route}] ${name} is not set — run: npx wrangler secret put ${name}`;
}

/**
 * POST /api/import/vision — two-stage page extraction for admin import.
 *
 * `stage: "extract"` (default) → Gemini 3 Flash (page image)
 * `stage: "recheck"` → Nemotron 3 Ultra (JSON only)
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
  if (!(await verifyStaffUser(config, token))) {
    return json({ error: "Staff access required" }, 403);
  }

  let payload: VisionRequest;
  try {
    payload = (await request.json()) as VisionRequest;
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  const stage: VisionStage = payload.stage === "recheck" ? "recheck" : "extract";
  const priorExtraction =
    typeof payload.priorExtraction === "string" ? payload.priorExtraction : undefined;

  if (stage === "recheck" && !priorExtraction?.trim()) {
    return json({ error: "priorExtraction is required for recheck" }, 400);
  }

  if (
    stage === "extract" &&
    (typeof payload.imageDataUrl !== "string" || !payload.imageDataUrl.trim())
  ) {
    return json({ error: "imageDataUrl is required" }, 400);
  }

  const apiKey =
    stage === "recheck" ? readEnv(env, "OPENROUTER_API_KEY") : readEnv(env, "GEMINI_API_KEY");
  if (!apiKey) {
    console.error(
      missingKeyMessage(
        stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY",
        "import/vision",
      ),
    );
    return json(
      {
        error:
          stage === "recheck"
            ? "Question recheck is not available right now."
            : "Question import vision is not available right now.",
      },
      503,
    );
  }

  try {
    const content = await extractSatPageFromImage(
      typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "",
      { apiKey, stage, priorExtraction },
    );
    return json({ content, stage }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("[import/vision] unexpected failure", error);
    return json({ error: "Failed to extract questions from this page." }, 500);
  }
}
