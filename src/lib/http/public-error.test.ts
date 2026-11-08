import { describe, expect, it, vi } from "vitest";
import { publicError } from "@/lib/http/public-error";

describe("publicError", () => {
  it("returns the fixed sentence instead of the database message", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      publicError(
        "claim",
        'duplicate key value violates unique constraint "profiles_username_key"',
        "Could not save your account.",
      ),
    ).toBe("Could not save your account.");
  });

  it("tells the user to pick a stronger password when Auth rejects it", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(
      publicError("claim", "Password should contain at least one character of each", "x"),
    ).toBe("Choose a stronger password.");
  });
});
