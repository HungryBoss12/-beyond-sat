import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/** A user is "online" if they pinged within this window. */
export const ONLINE_WINDOW_MS = 3 * 60 * 1000;
/** Ping interval. Comfortably inside the window so one missed beat is fine. */
const HEARTBEAT_MS = 60 * 1000;

export function isOnline(lastSeenAt: string | null | undefined): boolean {
  if (!lastSeenAt) return false;
  return Date.now() - new Date(lastSeenAt).getTime() < ONLINE_WINDOW_MS;
}

/** "2 minutes ago" style, kept short enough for a list row. */
export function lastSeenLabel(lastSeenAt: string | null | undefined): string {
  if (!lastSeenAt) return "Never seen";
  const mins = Math.floor((Date.now() - new Date(lastSeenAt).getTime()) / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `${days}d ago` : "Long ago";
}

/**
 * Stamps `profiles.last_seen_at` while the app is open, which is what the
 * admin user list reads to show an online dot.
 *
 * Pauses on a hidden tab so a browser left open overnight doesn't report the
 * user as online, and fires immediately on becoming visible again so the dot
 * comes back without waiting out the interval. Failures are swallowed on
 * purpose — presence is cosmetic and must never break a page render.
 */
export function usePresenceHeartbeat() {
  useEffect(() => {
    let cancelled = false;
    const beat = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        await supabase.rpc("touch_presence");
      } catch {
        /* presence is best-effort */
      }
    };
    void beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener("visibilitychange", beat);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
}
