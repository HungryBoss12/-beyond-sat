import sharp from "sharp";

const SRC = "public/pwa-icon.svg";

async function writeAny(size) {
  await sharp(SRC).resize(size, size).png().toFile(`public/pwa-${size}x${size}.png`);
}

async function writeMaskable(size) {
  const inset = Math.round(size * 0.72);
  const logo = await sharp(SRC).resize(inset, inset).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: "#0b0761",
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`public/pwa-maskable-${size}x${size}.png`);
}

await writeAny(192);
await writeAny(512);
await writeMaskable(192);
await writeMaskable(512);
console.log("PWA icons generated");
