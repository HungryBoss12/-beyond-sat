import { describe, expect, it } from "vitest";
import { profileFreezePlan } from "./profile-freeze";

const eng = "eng";
const math = "math";

describe("profileFreezePlan", () => {
  it("freezes every sub-class when none are frozen", () => {
    expect(
      profileFreezePlan([
        { groupId: eng, status: "active" },
        { groupId: math, status: "trial" },
      ]),
    ).toEqual({ freezeGroupIds: [eng, math], activateGroupIds: [] });
  });

  it("activates every sub-class when all are frozen", () => {
    expect(
      profileFreezePlan([
        { groupId: eng, status: "frozen" },
        { groupId: math, status: "frozen" },
      ]),
    ).toEqual({ freezeGroupIds: [], activateGroupIds: [eng, math] });
  });

  it("treats a scheduled freeze as activate, not as another freeze", () => {
    expect(
      profileFreezePlan([
        { groupId: eng, status: "active" },
        { groupId: math, status: "active", frozenOn: "2026-11-20" },
      ]),
    ).toEqual({ freezeGroupIds: [eng], activateGroupIds: [math] });
  });

  it("splits a mixed student so freeze does not touch the frozen subject", () => {
    expect(
      profileFreezePlan([
        { groupId: eng, status: "active" },
        { groupId: math, status: "frozen" },
      ]),
    ).toEqual({ freezeGroupIds: [eng], activateGroupIds: [math] });
  });
});
