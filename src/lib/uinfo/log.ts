import { supabase } from "@/integrations/supabase/client";

const ROUTE_GAP_MS = 10 * 60 * 1000;
const lastRoute = new Map<string, number>();

function clip(value: string): string {
  return value.replace(/\s+/g, "").slice(0, 24);
}

/** Tiny changelog row. Fire-and-forget; never blocks the UI. */
export function logUinfo(k: "r" | "t" | "v" | "l", d = ""): void {
  const detail = clip(d);
  if (k === "r") {
    const prev = lastRoute.get(detail) ?? 0;
    if (Date.now() - prev < ROUTE_GAP_MS) return;
    lastRoute.set(detail, Date.now());
  }

  void (async () => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      const { error } = await supabase.from("uinfo_log").insert({
        user_id: data.user.id,
        k,
        d: detail,
      });
      if (error) return;
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) return;
      await fetch("/api/ai/uinfo", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: "{}",
      });
    } catch {
      /* logging must never surface */
    }
  })();
}

export function logUinfoRoute(pathname: string): void {
  const skip = /^(admin|signin|signup|onboarding|first-login|banned|auth)/;
  const head = pathname.split("/").filter(Boolean)[0] ?? "";
  if (!head || skip.test(head)) return;
  logUinfo("r", head);
}
