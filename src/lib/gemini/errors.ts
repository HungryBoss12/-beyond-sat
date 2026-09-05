export type GeminiErrorCode =
  | "INVALID_IMAGE"
  | "MISSING_API_KEY"
  | "RATE_LIMIT"
  | "API_ERROR"
  | "EMPTY_RESPONSE"
  | "TIMEOUT";

export class GeminiError extends Error {
  readonly code: GeminiErrorCode;
  readonly status: number;

  constructor(code: GeminiErrorCode, message: string, status = 400) {
    super(message);
    this.name = "GeminiError";
    this.code = code;
    this.status = status;
  }
}

export function mapGeminiSdkError(error: unknown): GeminiError {
  const message = error instanceof Error ? error.message : String(error);
  const lower = message.toLowerCase();

  if (
    lower.includes("429") ||
    lower.includes("rate limit") ||
    lower.includes("quota") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests")
  ) {
    return new GeminiError(
      "RATE_LIMIT",
      "Gemini 3 Flash free limit reached. Waiting briefly, then using a backup model if needed.",
      429,
    );
  }

  if (lower.includes("api key") || lower.includes("api_key")) {
    return new GeminiError("MISSING_API_KEY", "Gemini API key is missing or invalid.", 503);
  }

  return new GeminiError("API_ERROR", message || "Gemini request failed.", 502);
}
