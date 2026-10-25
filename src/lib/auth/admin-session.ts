import { supabase } from "@/integrations/supabase/client";
import { removeSavedAccount } from "./account-switcher";
import { adminSessionExpired } from "./session-policy";

const CHECK_MS = 5 * 60 * 1000;

/** Signs an admin out once their sign-in is older than ADMIN_SESSION_HOURS. */
async function checkAdminSession(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session || !adminSessionExpired(session.access_token)) return;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", session.user.id);
  if (!(roles ?? []).some((row: { role: string }) => row.role === "admin")) return;
  await supabase.auth.signOut({ scope: "local" });
  removeSavedAccount(session.user.id);
  window.location.assign("/signin?expired=admin");
}

export function watchAdminSession(): () => void {
  const run = () => void checkAdminSession().catch(() => undefined);
  run();
  const timer = window.setInterval(run, CHECK_MS);
  const onVisible = () => {
    if (document.visibilityState === "visible") run();
  };
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}
