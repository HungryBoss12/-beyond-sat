import { fixBrokenQuestionWithGemini, type FixStage } from "@/lib/gemini/fix-question";
import { GeminiError } from "@/lib/gemini/errors";
import { readBearerToken, readEnv, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type FixRequest = {
  number?: unknown;
  rec?: unknown;
  errors?: unknown;
  warnings?: unknown;
  stage?: unknown;
  priorFix?: unknown;
};

/**
 * POST /api/import/fix — two-stage Gemini repair for broken import drafts.
 */
export async function handleImportFix(request: Request, env: unknown): Promise<Response> {
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const config = readSupabaseConfig(env);
  if (!config) {
    console.error("[import/fix] Supabase env missing; cannot authenticate requests");
    return json({ error: "Server is not configured" }, 500);
  }

  const token = readBearerToken(request);
  if (!token) {
    return json({ error: "Sign in to fix questions" }, 401);
  }

  const user = await verifySupabaseUser(config, token);
  if (!user) {
    return json({ error: "Your session has expired. Sign in again." }, 401);
  }

  let payload: FixRequest;
  try {
    payload = (await request.json()) as FixRequest;
  } catch {
    return json({ error: "Request body must be JSON" }, 400);
  }

  if (!payload.rec || typeof payload.rec !== "object" || Array.isArray(payload.rec)) {
    return json({ error: "rec must be an object" }, 400);
  }

  const number = typeof payload.number === "number" ? payload.number : Number(payload.number) || 0;
  const errors = Array.isArray(payload.errors)
    ? payload.errors.filter((e): e is string => typeof e === "string")
    : [];
  const warnings = Array.isArray(payload.warnings)
    ? payload.warnings.filter((w): w is string => typeof w === "string")
    : [];

  const stage: FixStage = payload.stage === "recheck" ? "recheck" : "extract";
  const priorFix = typeof payload.priorFix === "string" ? payload.priorFix : undefined;
  if (stage === "recheck" && !priorFix?.trim()) {
    return json({ error: "priorFix is required for recheck" }, 400);
  }

  const apiKey =
    stage === "recheck" ? readEnv(env, "OPENROUTER_API_KEY") : readEnv(env, "GEMINI_API_KEY");
  if (!apiKey) {
    console.error(
      import.meta.env.DEV
        ? `[import/fix] ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"} is not set — add it to .dev.vars or .env.local, then restart the dev server.`
        : `[import/fix] ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"} is not set — run: npx wrangler secret put ${stage === "recheck" ? "OPENROUTER_API_KEY" : "GEMINI_API_KEY"}`,
    );
    return json(
      {
        error:
          stage === "recheck"
            ? "Question recheck is not available right now."
            : "Question fix is not available right now.",
      },
      503,
    );
  }

  const rec: Record<string, string> = {};
  for (const [k, v] of Object.entries(payload.rec as Record<string, unknown>)) {
    if (typeof v === "string") rec[k] = v;
    else if (v != null) rec[k] = String(v);
  }

  try {
    const content = await fixBrokenQuestionWithGemini(
      { number, rec, errors, warnings },
      { apiKey, stage, priorFix },
    );
    return json({ content, stage }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("[import/fix] unexpected failure", error);
    return json({ error: "Failed to fix this question." }, 500);
  }
}
