export type JsonRead<T> = { ok: true; value: T } | { ok: false; status: 400 | 413 };

/**
 * Reads and parses a JSON request body while counting streamed bytes, so a
 * chunked or missing Content-Length request stops as soon as `maxBytes` is
 * exceeded rather than buffering the entire payload into isolate memory.
 */
export async function readJsonLimited<T>(
  request: Request,
  maxBytes = 16_384,
): Promise<JsonRead<T>> {
  const rawLen = request.headers.get("content-length");
  if (rawLen !== null && rawLen.trim() !== "") {
    const declared = Number(rawLen);
    if (!Number.isFinite(declared) || declared < 0) return { ok: false, status: 400 };
    if (declared > maxBytes) return { ok: false, status: 413 };
  }

  if (!request.body) return { ok: false, status: 400 };

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        return { ok: false, status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    const text = new TextDecoder("utf-8").decode(merged);
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function jsonReadError(status: 400 | 413): { error: string } {
  return { error: status === 413 ? "Request is too large." : "Invalid JSON" };
}
