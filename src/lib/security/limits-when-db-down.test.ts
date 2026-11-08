import { describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {},
  resetSupabaseAdmin: () => {},
  ensureSupabaseAdmin: () => {
    throw new Error("database unreachable");
  },
}));

const { inviteRateLimited } = await import("@/lib/auth/student-invite-handler");
const { linkAttemptAllowed } = await import("@/lib/telegram/link-throttle");

const fromIp = (ip: string) =>
  new Request("http://localhost/api/auth/preview-invite", {
    method: "POST",
    headers: { "cf-connecting-ip": ip },
  });

describe("rate limits when the database limiter is unavailable", () => {
  it("still throttles invite claims instead of letting every request through", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const statuses: number[] = [];
    for (let i = 0; i < 21; i++) {
      const limited = await inviteRateLimited(fromIp("203.0.113.7"), {}, "claim");
      statuses.push(limited?.status ?? 200);
    }
    expect(statuses.slice(0, 20).every((s) => s === 200)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it("caps Telegram /link guesses per chat", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const results: boolean[] = [];
    for (let i = 0; i < 6; i++) results.push(await linkAttemptAllowed({}, 424242));
    expect(results).toEqual([true, true, true, true, true, false]);
  });
});
