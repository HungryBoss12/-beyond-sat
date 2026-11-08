import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* No test database is configured, so these read the migration text. */
const sql = readFileSync("supabase/migrations/20261109000001_low_findings_hardening.sql", "utf8");

function functionBody(name: string): string {
  const start = sql.indexOf(`FUNCTION public.${name}(`);
  expect(start).toBeGreaterThan(-1);
  const end = sql.indexOf("$$;", start);
  return sql.slice(start, end);
}

describe("low-findings migration", () => {
  it("checks staff before looking up a username", () => {
    const body = functionBody("staff_assign_support_by_name");
    const staffCheck = body.indexOf("bs_is_staff()");
    expect(staffCheck).toBeGreaterThan(-1);
    expect(staffCheck).toBeLessThan(body.indexOf("FROM public.profiles"));
  });

  it("issues Telegram link codes of at least 10 characters", () => {
    const body = functionBody("admin_create_telegram_link_code");
    const length = Number(/'-', ''\), 1, (\d+)\)/.exec(body)?.[1]);
    expect(length).toBeGreaterThanOrEqual(10);
  });

  it("does not key the lead-form limit on the client-controlled first x-forwarded-for entry", () => {
    const body = functionBody("public_submit_lid");
    expect(body).not.toMatch(/split_part\([^;]*x-forwarded-for[^;]*,\s*1\)/);
    expect(body).toMatch(/lid-all/);
  });
});
