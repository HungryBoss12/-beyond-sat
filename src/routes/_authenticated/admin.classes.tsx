import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/classes")({
  component: AdminClassesLayout,
  head: () => ({ meta: [{ title: "Classes — Admin" }] }),
});

function AdminClassesLayout() {
  return <Outlet />;
}
