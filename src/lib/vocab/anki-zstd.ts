export const MAX_ANKI_ZSTD_BYTES = 150 * 1024 * 1024;

function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

/** Decompress Anki's zstd-framed collection.anki21b payload with a strict output byte cap. */
export async function decompressAnki21b(
  data: Uint8Array,
  maxBytes = MAX_ANKI_ZSTD_BYTES,
): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      /* "zstd" is newer than the DOM typings; browsers without it throw and
         fall through to fzstd. */
      const stream = new Blob([data as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("zstd" as CompressionFormat));
      const reader = stream.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (!value) continue;
        total += value.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => undefined);
          throw new Error("ZSTD_TOO_LARGE");
        }
        chunks.push(value);
      }
      return concatChunks(chunks, total);
    } catch (e) {
      if (e instanceof Error && e.message === "ZSTD_TOO_LARGE") {
        throw new Error("Uncompressed Anki database exceeds the 150 MB safety limit.");
      }
      /* fall through to fzstd when browser lacks DecompressionStream("zstd") */
    }
  }

  const { Decompress } = await import("fzstd");
  const chunks: Uint8Array[] = [];
  let total = 0;
  const dec = new Decompress((chunk) => {
    total += chunk.byteLength;
    if (total > maxBytes) {
      throw new Error("Uncompressed Anki database exceeds the 150 MB safety limit.");
    }
    chunks.push(chunk);
  });
  dec.push(data, true);
  return concatChunks(chunks, total);
}
