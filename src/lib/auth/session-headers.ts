import { supabase } from "@/integrations/supabase/client";

export async function sessionAuthHeaders(): Promise<HeadersInit> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sign in required");
  return {
    Authorization: `Bearer ${token}`,
    "content-type": "application/json",
  };
}
