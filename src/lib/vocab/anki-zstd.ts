/** Decompress Anki's zstd-framed collection.anki21b payload. */
export async function decompressAnki21b(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      /* "zstd" is newer than the DOM typings; browsers without it throw and
         fall through to fzstd. */
      const stream = new Blob([data as BlobPart])
        .stream()
        .pipeThrough(new DecompressionStream("zstd" as CompressionFormat));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      /* fall through to fzstd */
    }
  }

  const { decompress } = await import("fzstd");
  return decompress(data);
}
