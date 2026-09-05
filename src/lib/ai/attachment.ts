/**
 * Turn a picked or pasted image into a data URL small enough to send.
 *
 * Attachments travel inline: the Worker forwards the data URL to the model and
 * `ai_messages.image_url` keeps the same string so the turn still renders after a
 * reload. That makes the request body the real ceiling — `MAX_CHARS_PER_MESSAGE`
 * only applies to `text` parts — so a 12 MP phone photo is downscaled here rather
 * than rejected. Rejecting it is the version students hit constantly, because a
 * photo of a question is exactly what they have.
 *
 * 1600px on the long edge at quality 0.85 keeps 9pt exam text legible to a vision
 * model and lands a typical page around 300-600 KB base64. The same reasoning as
 * renderPdfPages (pdf.ts:174-187), one step higher because a student photographs
 * a whole page at an angle.
 */

import { loadHtmlImage } from "@/lib/load-image";

const MAX_EDGE = 1600;
const QUALITY = 0.85;
/** Roughly 1.5 MB of source bytes; anything above this is downscaled regardless. */
export const ATTACHMENT_SOFT_LIMIT = 1_500_000;

export const ACCEPTED_IMAGE_TYPES = "image/png,image/jpeg,image/webp";

/** Matches the server's allowlist in normalizeParts (router.ts). */
function isAcceptedType(type: string): boolean {
  return /^image\/(png|jpe?g|webp|gif)$/i.test(type);
}

/** Picks the image out of a paste or drop, if there is one. */
export function imageFromFiles(files: FileList | File[] | null | undefined): File | null {
  if (!files) return null;
  for (const file of Array.from(files)) {
    if (isAcceptedType(file.type)) return file;
  }
  return null;
}

/**
 * Reads a file to a data URL as-is. Used for a small PNG, where re-encoding to
 * JPEG would only make a screenshot of text blurrier.
 */
function readAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}

export async function prepareAttachment(file: File): Promise<string> {
  if (!isAcceptedType(file.type)) {
    throw new Error("Attach a PNG, JPEG or WebP image.");
  }

  const img = await loadHtmlImage(file);
  const longEdge = Math.max(img.naturalWidth, img.naturalHeight);

  /* Already small and already light: keep the original bytes. A screenshot of a
     question is usually a crisp PNG, and a JPEG round-trip visibly softens the
     thin strokes in a maths expression. */
  if (longEdge <= MAX_EDGE && file.size <= ATTACHMENT_SOFT_LIMIT) {
    return readAsDataUrl(file);
  }

  const ratio = Math.min(1, MAX_EDGE / longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(img.naturalWidth * ratio));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * ratio));
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("This browser wouldn't give a 2D canvas, so the image can't be resized.");

  /* White first: a transparent PNG has no alpha once it's JPEG, and without this
     the transparent parts arrive black. */
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", QUALITY);
  canvas.width = 0;
  canvas.height = 0;
  return dataUrl;
}
