import { describe, expect, it } from "vitest";
import { friendlyAuthError } from "@/lib/auth/callback-error";

describe("friendlyAuthError", () => {
  it("never shows text taken from the URL", () => {
    const spoof = "Your account is locked. Call +998 90 000 00 00 to unlock it.";
    expect(friendlyAuthError(spoof)).not.toContain("+998");
    expect(friendlyAuthError(spoof)).toBe("Sign-in didn't finish. Try again.");
  });

  it("keeps the closed-registration explanation", () => {
    expect(friendlyAuthError("Database error saving new user")).toMatch(/Registration is closed/);
  });

  it("returns null when there is no error", () => {
    expect(friendlyAuthError(null)).toBeNull();
  });
});
