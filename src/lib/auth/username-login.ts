import { supabase } from "@/integrations/supabase/client";

export async function signInWithUsername(username: string, password: string): Promise<void> {
  const res = await fetch("/api/auth/username-login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const body = (await res.json()) as {
    error?: string;
    access_token?: string;
    refresh_token?: string;
  };
  if (!res.ok || !body.access_token || !body.refresh_token) {
    throw new Error(body.error ?? "That username and password don't match.");
  }
  const { error } = await supabase.auth.setSession({
    access_token: body.access_token,
    refresh_token: body.refresh_token,
  });
  if (error) throw error;
}

export async function signInWithIdentifier(identifier: string, password: string): Promise<void> {
  const value = identifier.trim();
  if (value.includes("@")) {
    const { error } = await supabase.auth.signInWithPassword({ email: value, password });
    if (error) throw error;
    return;
  }
  await signInWithUsername(value, password);
}
