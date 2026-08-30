/** Decompress Anki's zstd-framed collection.anki21b payload. */
export async function decompressAnki21b(data: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("zstd"));
      const buf = await new Response(stream).arrayBuffer();
      return new Uint8Array(buf);
    } catch {
      /* fall through to fzstd */
    }
  }

  const { decompress } = await import("fzstd");
  return decompress(data);
}
