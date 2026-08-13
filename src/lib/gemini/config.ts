import { ThinkingLevel } from "@google/genai";

/**
 * Gemini 2.5 Pro was withdrawn. Gemini 3 Flash (`gemini-3-flash-preview`) has a
 * free Gemini API tier and reads page images — Nemotron 3 Ultra cannot.
 */
export const GEMINI_IMPORT_EXTRACT_MODEL = "gemini-3-flash-preview";

/**
 * Stage 2 — Nemotron 3 Ultra on OpenRouter (`:free`). Text-only, so it does
 * not spend Gemini quota. Same ID Beyond AI already uses for reasoning.
 */
export const IMPORT_RECHECK_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";

/** Keep thinking short so JSON extraction is not eaten by reasoning tokens. */
export const GEMINI_IMPORT_THINKING = { thinkingLevel: ThinkingLevel.LOW };

/** Room for multi-question pages with long passages. */
export const GEMINI_IMPORT_MAX_OUTPUT_TOKENS = 8192;

export const GEMINI_IMPORT_TEMPERATURE = 0.2;

/** @deprecated Prefer GEMINI_IMPORT_EXTRACT_MODEL */
export const GEMINI_IMPORT_MODEL = GEMINI_IMPORT_EXTRACT_MODEL;

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,/i;

export function parseImageDataUrl(dataUrl: string): { mimeType: string; buffer: Buffer } {
  if (!DATA_URL_RE.test(dataUrl)) {
    throw new Error("imageDataUrl must be a base64 PNG, JPEG, WebP, or GIF data URL.");
  }
  const headerEnd = dataUrl.indexOf(",");
  if (headerEnd === -1) {
    throw new Error("Malformed image data URL.");
  }
  const mimeType = dataUrl.slice(5, headerEnd).split(";")[0]?.toLowerCase() ?? "";
  const base64 = dataUrl.slice(headerEnd + 1);
  return { mimeType, buffer: Buffer.from(base64, "base64") };
}
