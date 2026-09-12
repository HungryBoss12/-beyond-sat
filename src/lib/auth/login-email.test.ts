import { describe, expect, it } from "vitest";
import {
  accountEmailFor,
  displayAccountEmail,
  isSyntheticAccountEmail,
  slugUsernameFromName,
} from "./login-email";

describe("login-email", () => {
  it("builds a synthetic login email", () => {
    expect(accountEmailFor("islom_admin")).toBe("islom_admin@accounts.beyondsat.local");
    expect(isSyntheticAccountEmail("islom_admin@accounts.beyondsat.local")).toBe(true);
    expect(displayAccountEmail("islom_admin@accounts.beyondsat.local")).toBeNull();
    expect(displayAccountEmail("student@gmail.com")).toBe("student@gmail.com");
  });

  it("slugs a display name into a username", () => {
    expect(slugUsernameFromName("Islom Admin")).toBe("islom_admin");
    expect(slugUsernameFromName("12")).toMatch(/^user/);
  });
});
