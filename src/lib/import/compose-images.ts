/** Stack multiple embedded source images vertically on a white canvas. */
export async function composeSourceImages(images: Blob[]): Promise<Blob> {
  if (images.length === 0) {
    throw new Error("No images to compose.");
  }
  if (images.length === 1) return images[0];

  const loaded = await Promise.all(
    images.map(
      (blob) =>
        new Promise<{ img: HTMLImageElement; w: number; h: number }>((resolve, reject) => {
          const img = new Image();
          const url = URL.createObjectURL(blob);
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ img, w: img.naturalWidth, h: img.naturalHeight });
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not load an embedded image."));
          };
          img.src = url;
        }),
    ),
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
