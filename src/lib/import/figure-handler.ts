import { locateFiguresOnPage } from "@/lib/gemini/locate-figure";
import { GeminiError } from "@/lib/gemini/errors";
import { readBearerToken, readEnv, readSupabaseConfig, verifySupabaseUser } from "@/lib/server-env";

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

type FigureQuestionHint = {
  draft_number?: unknown;
  stem?: unknown;
};

type FigureRequest = {
  imageDataUrl?: unknown;
  hint?: unknown;
  questions?: unknown;
  tableMarkdown?: unknown;
};

function parseQuestions(raw: unknown): { draft_number: number; stem: string }[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: { draft_number: number; stem: string }[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as FigureQuestionHint;
    const draft_number = Number(rec.draft_number);
    if (!Number.isFinite(draft_number) || draft_number < 1) continue;
    out.push({
      draft_number: Math.round(draft_number),
      stem: typeof rec.stem === "string" ? rec.stem.trim().slice(0, 200) : "",
    });
  }
  return out.length ? out : undefined;
}

/**
 * POST /api/import/figure — Gemini figure location for admin import.
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

  const hint = typeof payload.hint === "string" ? payload.hint : undefined;
  const questions = parseQuestions(payload.questions);
  const tableMarkdown = payload.tableMarkdown === true;

  const apiKey = readEnv(env, "GEMINI_API_KEY");
  if (!apiKey) {
    console.error(
      import.meta.env.DEV
        ? "[import/figure] GEMINI_API_KEY is not set — add it to .dev.vars or .env.local, then restart the dev server."
        : "[import/figure] GEMINI_API_KEY is not set — run: npx wrangler secret put GEMINI_API_KEY",
    );
    return json({ error: "Figure attach is not available right now." }, 503);
  }

  try {
    const content = await locateFiguresOnPage(
      typeof payload.imageDataUrl === "string" ? payload.imageDataUrl : "",
      {
        apiKey,
        hint,
        questions,
        tableMarkdown,
      },
    );
    return json({ content }, 200);
  } catch (error) {
    if (error instanceof GeminiError) {
      return json({ error: error.message, code: error.code }, error.status);
    }
    console.error("[import/figure] unexpected failure", error);
    return json({ error: "Failed to locate figures on this page." }, 500);
  }
}
