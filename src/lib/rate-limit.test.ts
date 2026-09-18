import { afterEach, describe, expect, it } from "vitest";
import { dailyCap, rateLimit, resetRateLimits } from "./rate-limit";

describe("rate-limit", () => {
  afterEach(() => resetRateLimits());

  it("allows up to capacity then blocks", () => {
    for (let i = 0; i < 5; i++) {
      expect(rateLimit("k1", 5, 0).ok).toBe(true);
    }
    const blocked = rateLimit("k1", 5, 0);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("keys are independent", () => {
    expect(rateLimit("a", 1, 0).ok).toBe(true);
    expect(rateLimit("b", 1, 0).ok).toBe(true);
    expect(rateLimit("a", 1, 0).ok).toBe(false);
  });

  it("refills over time", () => {
    // 6/minute = 1 token per 10s. Burn the burst, then simulate elapsed time
    // by checking the retry math: refill rate must yield a finite retryAfter.
    for (let i = 0; i < 20; i++) rateLimit("k2", 20, 6);
    const r = rateLimit("k2", 20, 6);
    expect(r.ok).toBe(false);
    // 1 token at 6/min -> at most 10s wait.
    expect(r.retryAfter).toBeLessThanOrEqual(10);
  });

  it("daily cap counts and reports seconds to UTC midnight", () => {
    expect(dailyCap("d1", 2).ok).toBe(true);
    expect(dailyCap("d1", 2).ok).toBe(true);
    const blocked = dailyCap("d1", 2);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfter).toBeGreaterThan(0);
    expect(blocked.retryAfter).toBeLessThanOrEqual(86400);
  });
});
