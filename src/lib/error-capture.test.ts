import { describe, expect, it, vi } from "vitest";
import { isClientAbort, silenceClientAborts } from "./error-capture";

describe("isClientAbort", () => {
  it("recognizes a browser disconnect during render", () => {
    const cause = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
    const error = Object.assign(new Error("aborted"), { cause, status: 500, unhandled: true });
    expect(isClientAbort(error)).toBe(true);
  });

  it("does not hide a real server error", () => {
    expect(isClientAbort(new Error("Could not load tests"))).toBe(false);
  });
});

describe("silenceClientAborts", () => {
  it("drops the disconnect h3 prints and keeps real errors", () => {
    const log = vi.fn();
    const filtered = silenceClientAborts(log);
    const cause = Object.assign(new Error("aborted"), { code: "ECONNRESET" });
    filtered(Object.assign(new Error("aborted"), { cause, status: 500, unhandled: true }));
    filtered(new Error("Could not load tests"));
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0]?.[0]).toMatchObject({ message: "Could not load tests" });
  });
});
