/** Decode a Blob or data URL into an HTMLImageElement, with a hard timeout. */
export function loadHtmlImage(
  source: Blob | string,
  timeoutMs = 20_000,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = typeof source === "string" ? null : URL.createObjectURL(source);
    let settled = false;

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      fn();
    };

    const timer = window.setTimeout(() => {
      finish(() => reject(new Error("That image took too long to open. Try a smaller PNG or JPEG.")));
    }, timeoutMs);

    img.onload = () => finish(() => resolve(img));
    img.onerror = () => finish(() => reject(new Error("That file didn't open as an image.")));
    img.src = objectUrl ?? (source as string);
  });
}
