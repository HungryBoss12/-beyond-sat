import { loadHtmlImage } from "@/lib/load-image";

function isBrowserLoadableImage(blob: Blob): boolean {
  const t = blob.type.toLowerCase();
  return (
    t === "image/png" ||
    t === "image/jpeg" ||
    t === "image/jpg" ||
    t === "image/gif" ||
    t === "image/webp"
  );
}

/** Stack multiple embedded source images vertically on a white canvas. */
export async function composeSourceImages(images: Blob[]): Promise<Blob> {
  const loadable = images.filter(isBrowserLoadableImage);
  if (loadable.length === 0) {
    throw new Error(
      "Embedded images use a format Word often saves as EMF/WMF, which browsers cannot display. Re-insert figures as PNG/JPEG in Word, or add image URLs manually in the editor.",
    );
  }
  if (loadable.length === 1) return loadable[0];

  const loaded = await Promise.all(
    loadable.map(async (blob) => {
      const img = await loadHtmlImage(blob);
      return { img, w: img.naturalWidth, h: img.naturalHeight };
    }),
  );

  const gap = 16;
  const width = Math.max(...loaded.map((l) => l.w));
  const height = loaded.reduce((sum, l) => sum + l.h, 0) + gap * (loaded.length - 1);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not compose embedded images.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  let y = 0;
  for (const { img, w, h } of loaded) {
    const x = Math.round((width - w) / 2);
    ctx.drawImage(img, x, y, w, h);
    y += h + gap;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode composed figure."))),
      "image/png",
    );
  });
  canvas.width = 0;
  canvas.height = 0;
  return blob;
}
