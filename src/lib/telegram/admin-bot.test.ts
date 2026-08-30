import { describe, expect, it } from "vitest";
import {
  banConfirmKeyboard,
  formatUsersList,
  parseCallbackData,
  parseCommand,
} from "@/lib/telegram/admin-bot";

describe("parseCommand", () => {
  it("parses basic commands", () => {
    expect(parseCommand("/start")).toEqual({ kind: "start" });
    expect(parseCommand("/help")).toEqual({ kind: "help" });
    expect(parseCommand("/link AB12CD")).toEqual({ kind: "link", code: "AB12CD" });
    expect(parseCommand("/users alice")).toEqual({ kind: "users", query: "alice" });
    expect(parseCommand("/user student@test.com")).toEqual({
      kind: "user",
      arg: "student@test.com",
    });
    expect(parseCommand("/tests student@test.com")).toEqual({
      kind: "tests",
      arg: "student@test.com",
    });
  });

  it("parses ban with optional reason", () => {
    expect(parseCommand("/ban bad@test.com spam account")).toEqual({
      kind: "ban",
      email: "bad@test.com",
      reason: "spam account",
    });
    expect(parseCommand("/unban bad@test.com")).toEqual({
      kind: "unban",
      email: "bad@test.com",
    });
  });

  it("returns unknown for non-commands", () => {
    expect(parseCommand("hello")).toEqual({ kind: "unknown", raw: "hello" });
  });
});

describe("parseCallbackData", () => {
  it("parses confirm and cancel callbacks", () => {
    expect(parseCallbackData("cancel")).toEqual({ kind: "cancel" });
    expect(parseCallbackData("ban:user-id:cheating")).toEqual({
      kind: "confirm",
      action: "ban",
      userId: "user-id",
      reason: "cheating",
    });
    expect(parseCallbackData("unban:user-id")).toEqual({
      kind: "confirm",
      action: "unban",
      userId: "user-id",
    });
  });
});

describe("banConfirmKeyboard", () => {
  const userId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

  it("keeps callback_data within Telegram 64-byte limit", () => {
    const kb = banConfirmKeyboard(userId, "x".repeat(200));
    const data = kb.inline_keyboard[0][0].callback_data ?? "";
    expect(data.length).toBeLessThanOrEqual(64);
    expect(data).toBe(`ban:${userId}`);
  });

  it("includes short reasons in callback_data", () => {
    const kb = banConfirmKeyboard(userId, "spam");
    expect(kb.inline_keyboard[0][0].callback_data).toBe(`ban:${userId}:spam`);
  });
});

describe("formatUsersList", () => {
  it("formats user rows for Telegram HTML", () => {
    const text = formatUsersList([
      {
        id: "abc",
        full_name: "Ada",
        email: "ada@test.com",
        tests_total: 3,
        current_streak: 2,
      },
    ]);
    expect(text).toContain("Ada");
    expect(text).toContain("ada@test.com");
    expect(text).toContain("3 tests");
  });
});
