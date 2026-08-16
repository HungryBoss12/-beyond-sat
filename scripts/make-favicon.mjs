/**
 * Regenerates the raster favicons from public/favicon.svg.
 *
 * One-off helper, run by hand after the logo changes:
 *   node scripts/make-favicon.mjs
 *
 * `sharp` arrives as a transitive dependency of the build toolchain rather than
 * a declared one, so install it first if this ever fails to resolve.
 */
import { writeFile, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("..", import.meta.url));
const source = await readFile(`${root}public/favicon.svg`);

/**
 * At 16px the two stacked layers smear into each other, so that slot gets the
 * mark reduced to its top facet, scaled up to fill the tile. Keep the colours
 * here in step with public/favicon.svg.
 */
const smallSource = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">` +
    `<rect width="32" height="32" rx="7" fill="#0b0761"/>` +
    `<path d="M16 7 29 15 16 23 3 15 16 7Z" fill="#ffffff"/>` +
    `</svg>`,
);

const render = (size, svg = source) =>
  sharp(svg, { density: 384 }).resize(size, size, { fit: "contain" }).png().toBuffer();

/** ICO container holding one PNG per size (Vista-era PNG-in-ICO, read everywhere). */
function packIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  let offset = header.length + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });

  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

const icoSizes = [16, 32, 48];
const icoImages = await Promise.all(
  icoSizes.map(async (size) => ({
    size,
    data: await render(size, size <= 16 ? smallSource : source),
  })),
);
await writeFile(`${root}public/favicon.ico`, packIco(icoImages));
await writeFile(`${root}public/apple-touch-icon.png`, await render(180));

console.log(`favicon.ico (${icoSizes.join(", ")}px) and apple-touch-icon.png written`);
