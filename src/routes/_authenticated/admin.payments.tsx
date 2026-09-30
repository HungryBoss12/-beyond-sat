import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/payments")({
  beforeLoad: ({ context }) => {
    const role = (context as { staffRole?: string }).staffRole;
    if (role && role !== "admin") throw redirect({ to: "/admin/questions" });
  },
  component: () => <Outlet />,
});
