/** Google AI Studio model for SAT page extraction (admin import). */
export const GEMINI_IMPORT_MODEL = "gemini-2.5-pro";

/** Matches the vision task ceiling in src/lib/ai/router.ts. */
export const GEMINI_IMPORT_MAX_OUTPUT_TOKENS = 1600;

/** Matches the vision task temperature in src/lib/ai/router.ts. */
export const GEMINI_IMPORT_TEMPERATURE = 0.3;

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
