import { supabase } from "@/integrations/supabase/client";

export type PostLoginPath = "/first-login" | "/onboarding" | "/dashboard";

/**
 * Where a signed-in person should land.
 * A forced password change comes first. An unfinished intro goes to onboarding,
 * including a student who just used a setup link.
 */
export async function pathAfterSignIn(): Promise<PostLoginPath> {
  const { data } = await supabase.auth.getUser();
  const id = data.user?.id;
  if (!id) return "/dashboard";

  const [{ data: cred }, { data: intro }] = await Promise.all([
    supabase.from("profiles").select("must_change_credentials").eq("id", id).maybeSingle(),
    supabase.from("profiles").select("intro_completed").eq("id", id).maybeSingle(),
  ]);
  if (cred?.must_change_credentials) return "/first-login";
  if (!intro?.intro_completed) return "/onboarding";
  return "/dashboard";
}
