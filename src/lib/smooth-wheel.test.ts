import { describe, expect, it } from "vitest";
import { wheelDeltaPixels } from "./smooth-wheel";

describe("wheelDeltaPixels", () => {
  it("keeps pixel deltas and turns line and page modes into pixels", () => {
    expect(wheelDeltaPixels(120, 0, 800)).toBe(120);
    expect(wheelDeltaPixels(3, 1, 800)).toBe(120);
    expect(wheelDeltaPixels(1, 2, 800)).toBe(800);
  });
});
