/**
 * In-process token-bucket rate limiter for the Worker.
 *
 * KEY CAVEAT (documented per plan): this is isolate-local state. Cloudflare
 * runs many isolates across colos, and each holds its own Map, so limits are
 * enforced *per isolate*, not globally. A determined attacker hitting
 * different colos multiplies their budget by the isolate count. That is still
 * a large improvement over none: it stops runaway loops, accidental floods,
 * and single-source brute force, with zero infrastructure cost and no KV
 * read latency on the hot path. If global precision is ever needed, swap the
 * Map for Workers KV / Durable Objects — the call sites don't change.
 *
 * Buckets are lazy: created on first hit, swept when the map grows past
 * `SWEEP_THRESHOLD` entries so long-lived isolates don't leak memory.
 */

type Bucket = {
  /** Tokens available right now (float; refill is fractional). */
  tokens: number;
  /** Last refill timestamp (ms, performance.now-independent Date.now). */
  updated: number;
};

const buckets = new Map<string, Bucket>();

/** Sweep when the map exceeds this many keys. */
const SWEEP_THRESHOLD = 2048;
/** Buckets idle longer than this are dropped during a sweep (ms). */
const IDLE_MS = 30 * 60 * 1000;

function sweep(now: number): void {
  if (buckets.size < SWEEP_THRESHOLD) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updated > IDLE_MS) buckets.delete(key);
  }
}

export type RateLimitResult = {
  /** true = allowed (a token was consumed). */
  ok: boolean;
  /** Seconds until the next token is available (0 when ok). */
  retryAfter: number;
};

/**
 * Consume one token from the bucket `key`.
 *
 * @param capacity  Max burst size (bucket depth).
 * @param refillPerMinute  Tokens added per minute (sustained rate).
 */
export function rateLimit(
  key: string,
  capacity: number,
  refillPerMinute: number,
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const refillPerMs = refillPerMinute / 60000;
  let bucket = buckets.get(key);
  if (!bucket) {
    // Start full so the first legitimate use is never throttled.
    bucket = { tokens: capacity, updated: now };
    buckets.set(key, bucket);
  }

  // Refill, clamped to capacity.
  bucket.tokens = Math.min(capacity, bucket.tokens + (now - bucket.updated) * refillPerMs);
  bucket.updated = now;

  if (bucket.tokens < 1) {
    const retryAfter = Math.ceil((1 - bucket.tokens) / refillPerMs / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }

  bucket.tokens -= 1;
  return { ok: true, retryAfter: 0 };
}

/** Fixed-window counter — for coarse "N per day" style caps. */
const windows = new Map<string, { count: number; reset: number }>();

export function dailyCap(
  key: string,
  maxPerDay: number,
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  let w = windows.get(key);
  if (!w || w.reset <= now) {
    // Reset at the next UTC midnight.
    const reset = Date.UTC(
      new Date(now).getUTCFullYear(),
      new Date(now).getUTCMonth(),
      new Date(now).getUTCDate() + 1,
    );
    w = { count: 0, reset };
    windows.set(key, w);
  }
  if (w.count >= maxPerDay) {
    return { ok: false, retryAfter: Math.ceil((w.reset - now) / 1000) };
  }
  w.count += 1;
  return { ok: true, retryAfter: 0 };
}

/** Test/ops hook: forget all state. */
export function resetRateLimits(): void {
  buckets.clear();
  windows.clear();
}
