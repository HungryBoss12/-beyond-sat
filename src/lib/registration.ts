import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

let cached: boolean | null = null;

/** True only when an admin has turned registration on. Missing or failed reads stay closed. */
export async function loadRegistrationEnabled(): Promise<boolean> {
  if (cached != null) return cached;
  // The RPC is granted to anon and is not in the generated Database types yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc("get_registration_state");
  cached = !error && data === true;
  return cached;
}

export function clearRegistrationCache(): void {
  cached = null;
}

export function useRegistrationEnabled(): boolean | null {
  const [enabled, setEnabled] = useState<boolean | null>(cached);
  useEffect(() => {
    let live = true;
    void loadRegistrationEnabled().then((value) => {
      if (live) setEnabled(value);
    });
    return () => {
      live = false;
    };
  }, []);
  return enabled;
}
