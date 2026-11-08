/** Falcon mark. The file is the square artwork, so the image is the tile. */
export function BrandMark({ className }: { className?: string }) {
  return (
    <img
      src="/brand-mark.png"
      alt=""
      draggable={false}
      className={"shrink-0 rounded-xl object-cover " + (className ?? "h-8 w-8")}
    />
  );
}
