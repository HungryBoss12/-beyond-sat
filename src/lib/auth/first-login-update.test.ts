import { describe, expect, it } from "vitest";
import { firstLoginAuthUpdate, firstLoginErrorMessage } from "@/lib/auth/first-login-update";
import { accountEmailFor } from "@/lib/auth/login-email";

describe("firstLoginAuthUpdate", () => {
  it("never marks a typed email as confirmed; it waits for the confirmation link", () => {
    const update = firstLoginAuthUpdate({
      password: "correct-horse",
      nextEmail: "victim@example.com",
      nextUsername: "ali",
      prevUsername: "ali",
      currentEmail: accountEmailFor("ali"),
    });
    expect(update.attributes).toEqual({ password: "correct-horse" });
    expect(update.pendingEmail).toBe("victim@example.com");
  });

  it("still renames the placeholder address when the username changes", () => {
    const update = firstLoginAuthUpdate({
      password: "correct-horse",
      nextEmail: "",
      nextUsername: "bobur",
      prevUsername: "ali",
      currentEmail: accountEmailFor("ali"),
    });
    expect(update.attributes).toEqual({
      password: "correct-horse",
      email: accountEmailFor("bobur"),
      email_confirm: true,
    });
    expect(update.pendingEmail).toBeNull();
  });

  it("leaves a real address alone when only the username changes", () => {
    const update = firstLoginAuthUpdate({
      password: "correct-horse",
      nextEmail: "",
      nextUsername: "bobur",
      prevUsername: "ali",
      currentEmail: "ali@school.uz",
    });
    expect(update.attributes).toEqual({ password: "correct-horse" });
  });
});

describe("firstLoginErrorMessage", () => {
  it("does not echo Supabase's wording, which reveals registered emails", () => {
    expect(
      firstLoginErrorMessage("A user with this email address has already been registered"),
    ).toBe("Could not update your account.");
  });

  it("keeps the username-taken message", () => {
    expect(firstLoginErrorMessage("username taken")).toBe("That username is already taken.");
  });
});
