import { describe, expect, it } from "vitest";
import { DEV_SERVER_FS_DENY, DEV_SERVER_HOST } from "@/lib/dev-server";

describe("dev server exposure", () => {
  it("listens on loopback only", () => {
    expect(DEV_SERVER_HOST).toBe("localhost");
  });

  it("never serves the Wrangler secrets file", () => {
    expect(DEV_SERVER_FS_DENY).toEqual(expect.arrayContaining([".dev.vars", ".dev.vars.*"]));
  });

  it("keeps Vite's default deny list, which a custom list replaces", () => {
    expect(DEV_SERVER_FS_DENY).toEqual(
      expect.arrayContaining([".env", ".env.*", "*.{crt,pem}", "**/.git/**"]),
    );
  });
});
