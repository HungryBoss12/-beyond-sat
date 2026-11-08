import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {},
  resetSupabaseAdmin: () => {},
  ensureSupabaseAdmin: () => {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not a service_role key");
  },
}));

const { handleAdminCreateUser } = await import("@/lib/auth/create-user-handler");
const { handleUinfoFlush } = await import("@/lib/uinfo/summarize");

const ENV = {
  SUPABASE_URL: "http://127.0.0.1:9",
  SUPABASE_PUBLISHABLE_KEY: "test-anon",
  SUPABASE_SERVICE_ROLE_KEY: "test-service",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("create-user", () => {
  it("rejects a caller without a session before revealing server configuration", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await handleAdminCreateUser(
      new Request("http://localhost/api/admin/create-user", { method: "POST", body: "{}" }),
      ENV,
    );
    expect(res.status).toBe(401);
    expect(await res.text()).not.toMatch(/service_role/i);
  });
});

describe("uinfo flush for another user", () => {
  it("is refused for staff who are not admins", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        const reply = (body: unknown) =>
          new Response(JSON.stringify(body), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        if (url.endsWith("/auth/v1/user"))
          return reply({ id: "11111111-1111-4111-8111-111111111111" });
        if (url.includes("/rest/v1/profiles")) return reply([{ banned: false }]);
        if (url.endsWith("/rpc/bs_is_staff")) return reply(true);
        if (url.endsWith("/rpc/bs_is_admin")) return reply(false);
        return reply([]);
      }),
    );
    const res = await handleUinfoFlush(
      new Request("http://localhost/api/ai/uinfo", {
        method: "POST",
        headers: { authorization: "Bearer editor-session" },
        body: JSON.stringify({ userId: "22222222-2222-4222-8222-222222222222" }),
      }),
      ENV,
    );
    expect(res.status).toBe(403);
  });
});
