import { describe, expect, it } from "vitest";
import { isAllowedVisionUrl } from "@/lib/gemini/vision-url";

const HOST = "project.supabase.co";
const PATH = "/storage/v1/object/sign/chat-images/u/1.png?token=t";

describe("isAllowedVisionUrl", () => {
  it("accepts this project's storage objects", () => {
    expect(isAllowedVisionUrl(new URL(`https://${HOST}${PATH}`), HOST)).toBe(true);
  });

  it("rejects another Supabase project", () => {
    expect(isAllowedVisionUrl(new URL(`https://attacker.supabase.co${PATH}`), HOST)).toBe(false);
  });

  it("rejects everything when the project host is unknown", () => {
    expect(isAllowedVisionUrl(new URL(`https://${HOST}${PATH}`), undefined)).toBe(false);
  });

  it("rejects non-storage paths and plain http", () => {
    expect(isAllowedVisionUrl(new URL(`https://${HOST}/rest/v1/profiles`), HOST)).toBe(false);
    expect(isAllowedVisionUrl(new URL(`http://${HOST}${PATH}`), HOST)).toBe(false);
  });
});
