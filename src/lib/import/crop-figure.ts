export type FigureBox = {
  x: number;
  y: number;
  w: number;
  h: number;
  caption?: string;
};

export function clampBox(box: FigureBox): FigureBox {
  const x = Math.min(0.95, Math.max(0, Number.isFinite(box.x) ? box.x : 0));
  const y = Math.min(0.95, Math.max(0, Number.isFinite(box.y) ? box.y : 0));
  const w = Math.min(1 - x, Math.max(0.04, Number.isFinite(box.w) ? box.w : 0.04));
  const h = Math.min(1 - y, Math.max(0.04, Number.isFinite(box.h) ? box.h : 0.04));
  const caption = typeof box.caption === "string" ? box.caption.trim() : "";
  return caption ? { x, y, w, h, caption } : { x, y, w, h };
}

export function parseFigureBoxes(text: string): FigureBox[] {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as { figures?: unknown };
    if (!Array.isArray(parsed.figures)) return [];
    return parsed.figures
      .filter(
        (f): f is Record<string, unknown> => !!f && typeof f === "object" && !Array.isArray(f),
      )
      .map((f) =>
        clampBox({
          x: Number(f.x),
          y: Number(f.y),
          w: Number(f.w),
          h: Number(f.h),
          caption: typeof f.caption === "string" ? f.caption : undefined,
        }),
      );
  } catch {
    return [];
  }
}

/** One crop that covers every detected figure on the page. */
export function unionBoxes(boxes: FigureBox[]): FigureBox | null {
  if (boxes.length === 0) return null;
  if (boxes.length === 1) return clampBox(boxes[0]);
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  let caption = "";
  for (const raw of boxes) {
    const b = clampBox(raw);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.w);
    maxY = Math.max(maxY, b.y + b.h);
    if (!caption && b.caption) caption = b.caption;
  }
  return clampBox({ x: minX, y: minY, w: maxX - minX, h: maxY - minY, caption });
}

export async function cropPageToBlob(dataUrl: string, box: FigureBox, pad = 0.02): Promise<Blob> {
  const img = new Image();
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("Could not load the page image to crop."));
  });
  img.src = dataUrl;
  await loaded;

  const padded = clampBox({
    x: box.x - pad,
    y: box.y - pad,
    w: box.w + pad * 2,
    h: box.h + pad * 2,
    caption: box.caption,
  });
  const sx = Math.round(padded.x * img.naturalWidth);
  const sy = Math.round(padded.y * img.naturalHeight);
  const sw = Math.max(1, Math.round(padded.w * img.naturalWidth));
  const sh = Math.max(1, Math.round(padded.h * img.naturalHeight));

  const canvas = document.createElement("canvas");
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext("2d");
  if (!ctx)
    throw new Error("This browser wouldn't give a 2D canvas, so the figure can't be cropped.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, sw, sh);
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode the cropped figure."))),
      "image/jpeg",
      0.85,
    );
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}
