import { ThinkingLevel } from "@google/genai";

/**
 * Gemini 2.5 Pro was withdrawn. Gemini 3 Flash (`gemini-3-flash-preview`) has a
 * free Gemini API tier and reads page images — Nemotron 3 Ultra cannot.
 */
export const GEMINI_IMPORT_EXTRACT_MODEL = "gemini-3-flash-preview";

/** Beyonder Vision chat — same model and key as import extraction. */
export const GEMINI_CHAT_VISION_MODEL = GEMINI_IMPORT_EXTRACT_MODEL;

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
export const DEFAULT_MAX_DATA_IMAGE_BYTES = 12 * 1024 * 1024;

export function parseImageDataUrl(
  dataUrl: string,
  maxBytes = DEFAULT_MAX_DATA_IMAGE_BYTES,
): { mimeType: string; buffer: Buffer } {
  if (!DATA_URL_RE.test(dataUrl)) {
    throw new Error("imageDataUrl must be a base64 PNG, JPEG, WebP, or GIF data URL.");
  }
  const headerEnd = dataUrl.indexOf(",");
  if (headerEnd === -1) {
    throw new Error("Malformed image data URL.");
  }
  const mimeType = dataUrl.slice(5, headerEnd).split(";")[0]?.toLowerCase() ?? "";
  const base64 = dataUrl.slice(headerEnd + 1).trim();
  const pad = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const approxBytes = Math.max(0, Math.floor((base64.length * 3) / 4) - pad);
  if (approxBytes > maxBytes) {
    throw new Error("That image is too large.");
  }
  const buffer = Buffer.from(base64, "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > maxBytes) {
    throw new Error("That image is too large.");
  }
  return { mimeType, buffer };
}
