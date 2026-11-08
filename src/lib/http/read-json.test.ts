import { describe, expect, it } from "vitest";
import { readJsonLimited } from "@/lib/http/read-json";

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/auth/username-login", { method: "POST", body, headers });

describe("readJsonLimited", () => {
  it("parses a normal body", async () => {
    expect(await readJsonLimited(post('{"username":"ali"}'))).toEqual({
      ok: true,
      value: { username: "ali" },
    });
  });

  it("refuses a body over the cap without parsing it", async () => {
    const big = JSON.stringify({ username: "a".repeat(20_000) });
    expect(await readJsonLimited(post(big))).toEqual({ ok: false, status: 413 });
  });

  it("refuses an oversized declared length", async () => {
    expect(await readJsonLimited(post("{}", { "content-length": "999999" }))).toEqual({
      ok: false,
      status: 413,
    });
  });

  it("reports malformed JSON as a bad request", async () => {
    expect(await readJsonLimited(post("{nope"))).toEqual({ ok: false, status: 400 });
  });
});
