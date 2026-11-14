import { describe, expect, it } from "vitest";
import {
  cropSquare,
  isAvatarPath,
  isStoredAvatarRef,
  newAvatarPath,
  outputEdge,
} from "./paths";

const ME = "11111111-2222-3333-4444-555555555555";
const OTHER = "99999999-2222-3333-4444-555555555555";

describe("avatar paths", () => {
  it("accepts only a file in the owner's folder", () => {
    expect(isAvatarPath(`${ME}/avatar-abcdef12.webp`, ME)).toBe(true);
    expect(isAvatarPath(`${ME}/avatar-1731000000000.jpg`, ME)).toBe(true);
    expect(isAvatarPath(`${OTHER}/avatar-abcdef12.webp`, ME)).toBe(false);
    expect(isAvatarPath(`${ME}/../${OTHER}/avatar-abcdef12.webp`, ME)).toBe(false);
    expect(isAvatarPath("https://evil.example/a.png", ME)).toBe(false);
    expect(isAvatarPath("data:image/png;base64,AAAA", ME)).toBe(false);
    expect(isAvatarPath(null, ME)).toBe(false);
  });

  it("builds a path the validator accepts", () => {
    expect(isAvatarPath(newAvatarPath(ME, "webp", "a1b2c3d4e5"), ME)).toBe(true);
  });

  it("treats URLs and data URIs as not stored", () => {
    expect(isStoredAvatarRef(`${ME}/avatar-abcdef12.webp`)).toBe(true);
    expect(isStoredAvatarRef("https://x.example/a.png")).toBe(false);
    expect(isStoredAvatarRef("data:image/png;base64,AAAA")).toBe(false);
    expect(isStoredAvatarRef("")).toBe(false);
  });
});

describe("avatar crop", () => {
  it("centres the square on a wide image", () => {
    expect(cropSquare(800, 400)).toEqual({ sx: 200, sy: 0, size: 400 });
  });
  it("centres the square on a tall image", () => {
    expect(cropSquare(300, 900)).toEqual({ sx: 0, sy: 300, size: 300 });
  });
  it("keeps a square image whole", () => {
    expect(cropSquare(600, 600)).toEqual({ sx: 0, sy: 0, size: 600 });
  });
  it("never upscales a small photo", () => {
    expect(outputEdge(200)).toBe(200);
    expect(outputEdge(4000)).toBe(512);
  });
});
