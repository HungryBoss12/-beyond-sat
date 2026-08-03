import { supabase } from "@/integrations/supabase/client";

/** Roles that can open the admin panel, most privileged first. */
export type StaffRole = "admin" | "editor";

/**
 * The only admin sections an editor may open. Everything else — Overview,
 * Homepage, Tests, Exam Dates, Users, Settings — is admin-only.
 */
export const EDITOR_SECTIONS = [
  "/admin/questions",
  "/admin/import",
  "/admin/daily",
  "/admin/mocks",
  "/admin/news",
] as const;

export function canEditorAccess(pathname: string): boolean {
  return EDITOR_SECTIONS.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

/** Where an editor lands when they hit the panel root or an off-limits path. */
export const EDITOR_HOME = "/admin/questions";

/**
 * Reads every role row for a user and picks the strongest.
 *
 * Deliberately unfiltered: filtering server-side with `.eq("role", "editor")`
 * sends the literal to Postgres, which rejects it as an invalid `app_role`
 * value until the enum migration has run — that would lock admins out of the
 * panel in the window before the SQL is applied. Comparing in JS can't fail.
 */
export async function getStaffRole(userId: string): Promise<StaffRole | null> {
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
  const roles = (data ?? []).map((r: { role: string }) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("editor")) return "editor";
  return null;
}

export async function isAdmin(userId: string): Promise<boolean> {
  return (await getStaffRole(userId)) === "admin";
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}
