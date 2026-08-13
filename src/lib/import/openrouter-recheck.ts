import { GeminiError } from "@/lib/gemini/errors";
import {
  GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
  GEMINI_IMPORT_TEMPERATURE,
  IMPORT_RECHECK_MODEL,
} from "@/lib/gemini/config";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

/**
 * Stage-2 import recheck via OpenRouter (Nemotron 3 Ultra).
 *
 * Gemini 3 Flash is reserved for the page-image pass so we do not burn its
 * free quota twice. Ultra is text-only: it verifies JSON, it cannot see the scan.
 */
export async function completeOpenRouterJson(opts: {
  apiKey: string;
  system: string;
  user: string;
  maxTokens?: number;
}): Promise<string> {
  const apiKey = opts.apiKey.trim();
  if (!apiKey) {
    throw new GeminiError(
      "MISSING_API_KEY",
      "OPENROUTER_API_KEY is not configured on the server.",
      503,
    );
  }

  let response: Response;
  try {
    response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "HTTP-Referer": "https://beyondsat.app",
        "X-Title": "Beyond SAT",
      },
      body: JSON.stringify({
        model: IMPORT_RECHECK_MODEL,
        messages: [
          { role: "system", content: opts.system },
          { role: "user", content: opts.user },
        ],
        temperature: GEMINI_IMPORT_TEMPERATURE,
        max_tokens: opts.maxTokens ?? GEMINI_IMPORT_MAX_OUTPUT_TOKENS,
        stream: false,
      }),
    });
  } catch {
    throw new GeminiError("API_ERROR", "Recheck model could not be reached.", 502);
  }

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(
      `[import/recheck] openrouter ${response.status} for ${IMPORT_RECHECK_MODEL}: ${detail.slice(0, 400)}`,
    );
    if (response.status === 429) {
      throw new GeminiError(
        "RATE_LIMIT",
        "Recheck model is busy. Wait a moment and try again.",
        429,
      );
    }
    if (response.status === 401 || response.status === 402 || response.status === 404) {
      throw new GeminiError("MISSING_API_KEY", "Recheck model is not available right now.", 503);
    }
    throw new GeminiError("API_ERROR", "Recheck failed.", 502);
  }

  const data = (await response.json()) as {
    choices?: { message?: { content?: unknown } }[];
  };
  const content = data.choices?.[0]?.message?.content;
  const text = typeof content === "string" ? content.trim() : "";
  if (!text) {
    throw new GeminiError("EMPTY_RESPONSE", "Recheck returned no content.", 502);
  }
  return text;
}
