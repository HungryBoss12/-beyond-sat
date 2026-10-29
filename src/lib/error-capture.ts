// Captures the original Error out-of-band so server.ts can recover the stack
// when h3 has already swallowed the throw into a generic 500 Response.

let lastCapturedError: { error: unknown; at: number } | undefined;
const TTL_MS = 5_000;

function record(error: unknown) {
  lastCapturedError = { error, at: Date.now() };
}

if (typeof globalThis.addEventListener === "function") {
  globalThis.addEventListener("error", (event) => record((event as ErrorEvent).error ?? event));
  globalThis.addEventListener("unhandledrejection", (event) =>
    record((event as PromiseRejectionEvent).reason),
  );
}

export function consumeLastCapturedError(): unknown {
  if (!lastCapturedError) return undefined;
  if (Date.now() - lastCapturedError.at > TTL_MS) {
    lastCapturedError = undefined;
    return undefined;
  }
  const { error } = lastCapturedError;
  lastCapturedError = undefined;
  return error;
}

/** A visitor left while the page was still rendering. Not a server failure. */
export function isClientAbort(error: unknown): boolean {
  if (typeof error === "string") return /\baborted\b|ECONNRESET/i.test(error);
  if (!error || typeof error !== "object") return false;
  const record = error as { name?: unknown; message?: unknown; code?: unknown; cause?: unknown };
  if (record.name === "AbortError" || record.code === "ECONNRESET") return true;
  if (typeof record.message === "string" && /\baborted\b|ECONNRESET/i.test(record.message)) return true;
  return isClientAbort(record.cause);
}

/** h3 prints every unhandled throw. A closed browser connection is one of those. */
export function silenceClientAborts(log: (...args: unknown[]) => void): (...args: unknown[]) => void {
  return (...args) => {
    if (args.some((arg) => isClientAbort(arg))) return;
    log(...args);
  };
}
