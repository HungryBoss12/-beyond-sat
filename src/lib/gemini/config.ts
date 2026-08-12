/** Stage 1 — careful extraction (stronger model). */
export const GEMINI_IMPORT_EXTRACT_MODEL = "gemini-2.5-pro";

/** Stage 2 — independent recheck (second model). */
export const GEMINI_IMPORT_RECHECK_MODEL = "gemini-2.5-flash";

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
