import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getStaffRole } from "@/lib/admin";

export const Route = createFileRoute("/_authenticated/admin/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/signin" });
    if ((await getStaffRole(data.user.id)) !== "admin") throw redirect({ to: "/admin/questions" });
  },
  component: AdminUsersLayout,
  head: () => ({ meta: [{ title: "Students — Admin — BeyondSAT" }] }),
});

function AdminUsersLayout() {
  return <Outlet />;
}
