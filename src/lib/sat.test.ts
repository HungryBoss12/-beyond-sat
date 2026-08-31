import { describe, expect, it } from "vitest";
import { paperKey, stripModuleSuffix } from "./sat";

describe("stripModuleSuffix", () => {
  it("strips · Module N titles", () => {
    expect(stripModuleSuffix("May 2024 · Module 2")).toBe("May 2024");
  });

  it("strips Mod N without a separator before module", () => {
    expect(stripModuleSuffix("DSAT March 2024 — EBRW Mod 1")).toBe("DSAT March 2024 — EBRW");
    expect(stripModuleSuffix("DSAT March 2024 — Math Mod 2")).toBe("DSAT March 2024 — Math");
  });
});

describe("paperKey", () => {
  it("pairs both modules of the same paper", () => {
    const mod1 = paperKey("DSAT March 2024 — EBRW Mod 1", "reading_writing");
    const mod2 = paperKey("DSAT March 2024 — EBRW · Module 2", "reading_writing");
    expect(mod1).toBe(mod2);
  });
});
