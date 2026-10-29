import { describe, expect, it } from "vitest";
import { safeMediaUrl, safeNavigationUrl } from "./safe-url";

describe("safeNavigationUrl", () => {
  it("keeps site paths and web links", () => {
    expect(safeNavigationUrl("/signup")).toBe("/signup");
    expect(safeNavigationUrl("https://beyondsat.uz/practice")).toBe("https://beyondsat.uz/practice");
  });

  it("rejects file urls and windows paths", () => {
    expect(safeNavigationUrl("file:///C:/Windows/notepad.exe")).toBeNull();
    expect(safeNavigationUrl("file://")).toBeNull();
    expect(safeNavigationUrl("C:\\Users\\javaz\\video.mp4")).toBeNull();
    expect(safeNavigationUrl("javascript:alert(1)")).toBeNull();
  });
});

describe("safeMediaUrl", () => {
  it("rejects a file image and keeps an https image", () => {
    expect(safeMediaUrl("file:///C:/photo.png")).toBeNull();
    expect(safeMediaUrl("https://cdn.example.com/a.png")).toBe("https://cdn.example.com/a.png");
  });
});
