import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dropUnkeptSession,
  isKeepSignedIn,
  readKeptRefresh,
  setKeepSignedIn,
  writeKeptRefresh,
} from "./session-policy";

function installBrowser() {
  const bag = new Map<string, string>();
  const localStorage = {
    get length() {
      return bag.size;
    },
    key(index: number) {
      return [...bag.keys()][index] ?? null;
    },
    getItem(key: string) {
      return bag.has(key) ? bag.get(key)! : null;
    },
    setItem(key: string, value: string) {
      bag.set(key, String(value));
    },
    removeItem(key: string) {
      bag.delete(key);
    },
  };
  vi.stubGlobal("window", { location: { protocol: "http:" } });
  vi.stubGlobal("localStorage", localStorage);
  vi.stubGlobal("document", { cookie: "" });
  return bag;
}

describe("keep me signed in", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores a refresh token only while the box is checked", () => {
    installBrowser();
    setKeepSignedIn(true);
    writeKeptRefresh("user-1", "refresh-1");
    expect(isKeepSignedIn()).toBe(true);
    expect(readKeptRefresh()).toEqual({ "user-1": "refresh-1" });

    setKeepSignedIn(false);
    expect(isKeepSignedIn()).toBe(false);
    expect(readKeptRefresh()).toEqual({});
  });

  it("drops the stored session after the browser closes when the box is off", () => {
    const bag = installBrowser();
    bag.set("beyondsat.keep-signed-in", "0");
    bag.set(
      "sb-project-auth-token",
      JSON.stringify({ user: { id: "user-1" }, refresh_token: "refresh-1" }),
    );
    bag.set("beyondsat.saved-accounts", JSON.stringify([{ userId: "user-1" }, { userId: "user-2" }]));
    bag.set("beyondsat.kept-refresh", JSON.stringify({ "user-1": "refresh-1" }));

    dropUnkeptSession();

    expect(bag.has("sb-project-auth-token")).toBe(false);
    expect(bag.has("beyondsat.kept-refresh")).toBe(false);
    expect(JSON.parse(bag.get("beyondsat.saved-accounts") ?? "[]")).toEqual([{ userId: "user-2" }]);
  });

  it("leaves the session in place when the box is on", () => {
    const bag = installBrowser();
    bag.set("beyondsat.keep-signed-in", "1");
    bag.set("sb-project-auth-token", "{}");
    dropUnkeptSession();
    expect(bag.has("sb-project-auth-token")).toBe(true);
  });
});
