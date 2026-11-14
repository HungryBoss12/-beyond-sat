import {
  AVATAR_MAX_INPUT_BYTES,
  AVATAR_SIZE_PX,
  cropSquare,
  outputEdge,
} from "./paths";

export type PreparedAvatar = { blob: Blob; ext: "webp" | "jpg" };

function isHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close: () => void }> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close() };
    } catch {
      /* fall through to <img> */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality));
}

/** Centre-crop to a square, shrink to at most 512 px, encode as WebP (JPEG if WebP is unavailable). */
export async function prepareAvatar(file: File): Promise<PreparedAvatar> {
  if (isHeic(file)) {
    throw new Error("HEIC photos are not supported. Save the photo as JPEG or PNG and try again.");
  }
  if (!/^image\/(jpeg|png|webp|gif)$/i.test(file.type)) {
    throw new Error("Choose a JPEG, PNG or WebP photo.");
  }
  if (file.size > AVATAR_MAX_INPUT_BYTES) {
    throw new Error("That photo is too large. Choose one under 15 MB.");
  }

  let decoded: Awaited<ReturnType<typeof decode>>;
  try {
    decoded = await decode(file);
  } catch {
    throw new Error("That file could not be read as a photo.");
  }

  try {
    const { sx, sy, size } = cropSquare(decoded.width, decoded.height);
    if (size < 1) throw new Error("That file could not be read as a photo.");
    const edge = outputEdge(size, AVATAR_SIZE_PX);
    const canvas = document.createElement("canvas");
    canvas.width = edge;
    canvas.height = edge;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Your browser cannot process photos.");
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(decoded.source, sx, sy, size, size, 0, 0, edge, edge);

    const webp = await toBlob(canvas, "image/webp", 0.85);
    if (webp && webp.type === "image/webp") return { blob: webp, ext: "webp" };
    const jpeg = await toBlob(canvas, "image/jpeg", 0.88);
    if (!jpeg) throw new Error("Could not prepare the photo.");
    return { blob: jpeg, ext: "jpg" };
  } finally {
    decoded.close();
  }
}
