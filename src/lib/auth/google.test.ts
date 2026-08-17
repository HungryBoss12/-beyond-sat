import { describe, expect, it } from "vitest";
import { isExemptPath } from "@/lib/maintenance";

describe("maintenance exempt paths", () => {
  it("keeps the Google OAuth callback reachable", () => {
    expect(isExemptPath("/auth")).toBe(true);
    expect(isExemptPath("/auth/callback")).toBe(true);
  });
});
