import { describe, expect, it } from "vitest";
import { parseStorageRef, toPersistableImageRef } from "./storage-url";

describe("parseStorageRef", () => {
  it("parses a bare object path", () => {
    expect(parseStorageRef("abc.png")).toEqual({ bucket: "question-images", path: "abc.png" });
  });

  it("parses a prefixed folder path", () => {
    expect(parseStorageRef("may2025-math/abc.png")).toEqual({
      bucket: "question-images",
      path: "may2025-math/abc.png",
    });
  });

  it("parses a signed URL", () => {
    expect(
      parseStorageRef(
        "https://x.supabase.co/storage/v1/object/sign/question-images/may2025-math/abc.png?token=1",
      ),
    ).toEqual({ bucket: "question-images", path: "may2025-math/abc.png" });
  });

  it("parses a homework-uploads prefix", () => {
    expect(parseStorageRef("homework-uploads/notifications/a.png")).toEqual({
      bucket: "homework-uploads",
      path: "notifications/a.png",
    });
  });

  it("ignores data URLs and external https", () => {
    expect(parseStorageRef("data:image/png;base64,aaa")).toBeNull();
    expect(parseStorageRef("https://cdn.example.com/x.png")).toBeNull();
  });
});

describe("toPersistableImageRef", () => {
  it("never keeps a data URL", () => {
    expect(toPersistableImageRef("data:image/png;base64,aaa")).toBeNull();
  });

  it("stores question-image paths without the bucket prefix", () => {
    expect(
      toPersistableImageRef(
        "https://x.supabase.co/storage/v1/object/sign/question-images/uuid.png?token=1",
      ),
    ).toBe("uuid.png");
  });

  it("stores notification refs as homework-uploads/...", () => {
    expect(toPersistableImageRef("notifications/a.png", "homework-uploads")).toBe(
      "homework-uploads/notifications/a.png",
    );
  });
});
