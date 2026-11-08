export type JsonRead<T> = { ok: true; value: T } | { ok: false; status: 400 | 413 };

/** Public endpoints take small JSON bodies; anything larger only costs the isolate memory. */
export async function readJsonLimited<T>(
  request: Request,
  maxBytes = 16_384,
): Promise<JsonRead<T>> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413 };
  const text = await request.text();
  if (new TextEncoder().encode(text).length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch {
    return { ok: false, status: 400 };
  }
}

export function jsonReadError(status: 400 | 413): { error: string } {
  return { error: status === 413 ? "Request is too large." : "Invalid JSON" };
}
