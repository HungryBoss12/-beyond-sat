import { createFileRoute, Outlet, redirect, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    if (!location.pathname.startsWith("/onboarding")) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("intro_completed")
        .eq("id", data.user.id)
        .maybeSingle();
      // If the profile row hasn't been created yet by the trigger, or intro isn't finished, send to onboarding.
      if (!prof || !prof.intro_completed) throw redirect({ to: "/onboarding" });
    }
    return { user: data.user };
  },
  component: Layout,
});

function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const bare = pathname.startsWith("/onboarding") || pathname.startsWith("/admin");
  if (bare) return <Outlet />;
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
