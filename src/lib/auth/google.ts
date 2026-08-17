import { supabase } from "@/integrations/supabase/client";
import { appUrl } from "@/lib/app-url";

/**
 * Where Google/Supabase should send the user after they pick an account.
 *
 * PKCE stores the code verifier in this browser, so the return URL must be the
 * origin the click happened on — not the production `VITE_APP_URL` used for
 * confirmation emails. Fall back to `appUrl` only when there is no window
 * (SSR), which never starts OAuth itself.
 */
export function googleRedirectTo(): string {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/auth/callback`;
  }
  return appUrl("/auth/callback");
}

export async function signInWithGoogle(): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: googleRedirectTo(),
      queryParams: {
        access_type: "offline",
        prompt: "select_account",
      },
    },
  });
  if (error) throw error;
}
