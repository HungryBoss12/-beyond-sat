import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";
import { usePresenceHeartbeat } from "@/lib/presence";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    const uid = data.user.id;
    const onOnboarding = location.pathname.startsWith("/onboarding");
    /* `banned` is fetched separately rather than folded into the
       intro_completed select. If the ban migration hasn't been applied yet that
       request errors and returns no row — combined, that would read as "no
       profile" and bounce every user into onboarding. Split, a missing column
       just means "not banned". */
    const [{ data: prof }, { data: ban }] = await Promise.all([
      onOnboarding
        ? Promise.resolve({ data: null })
        : supabase.from("profiles").select("intro_completed").eq("id", uid).maybeSingle(),
      supabase.from("profiles").select("banned").eq("id", uid).maybeSingle(),
    ]);
    if (ban?.banned) throw redirect({ to: "/banned" });
    // If the profile row hasn't been created yet by the trigger, or intro isn't finished, send to onboarding.
    if (!onOnboarding && (!prof || !prof.intro_completed)) throw redirect({ to: "/onboarding" });
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  /* Stamps last_seen_at while any signed-in page is open. It lives here rather
     than in AppShell so presence keeps ticking on the full-screen routes below,
     which render outside the shell. */
  usePresenceHeartbeat();
  /* A live test session is a full-screen runner (Bluebook-style): its own top
     bar, timer and question navigator replace the app chrome. Rendering it
     inside AppShell stacked the app header above it and put the mobile tab bar
     over its bottom nav — and, worse, AppShell's animated `route-enter` wrapper
     became the containing block for the runner's `position: fixed` root, which
     squeezed it to a few pixels and left the rest of the screen blank. */
  const bare =
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/practice/session");
  if (bare) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
