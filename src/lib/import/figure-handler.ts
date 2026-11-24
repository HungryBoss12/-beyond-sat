import { locateFiguresOnPage } from "@/lib/gemini/locate-figure";
import { GeminiError } from "@/lib/gemini/errors";
import { readJsonLimited } from "@/lib/http/read-json";
import { readEnv } from "@/lib/server-env";
import { sharedRateLimit } from "@/lib/shared-rate-limit";
import { requireStaff } from "@/lib/vocab/rest";

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
  graphMarkdown?: unknown;
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

  const auth = await requireStaff(request, env);
  if (!auth.ok) return auth.response;

  const limit = await sharedRateLimit(env, `import-ai:${auth.user.id}`, 30, 10);
  if (!limit.ok) {
    return new Response(JSON.stringify({ error: "Too many import requests. Wait a moment." }), {
      status: 429,
      headers: {
        "content-type": "application/json; charset=utf-8",
        "retry-after": String(limit.retryAfter || 10),
      },
    });
  }

  const read = await readJsonLimited<FigureRequest>(request, 16 * 1024 * 1024);
  if (!read.ok) {
    return json(
      { error: read.status === 413 ? "Request is too large." : "Request body must be JSON" },
      read.status,
    );
  }
  const payload = read.value;

  if (typeof payload.imageDataUrl !== "string" || !payload.imageDataUrl.trim()) {
    return json({ error: "imageDataUrl is required" }, 400);
  }

  const hint = typeof payload.hint === "string" ? payload.hint : undefined;
  const questions = parseQuestions(payload.questions);
  const tableMarkdown = payload.tableMarkdown === true;
  const graphMarkdown = payload.graphMarkdown === true;

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
        graphMarkdown,
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
