import { createFileRoute, getRouteApi } from "@tanstack/react-router";
import { AdminDesk } from "@/components/support/AdminDesk";
import { TeacherDesk } from "@/components/support/TeacherDesk";

const adminRoute = getRouteApi("/_authenticated/admin");

export const Route = createFileRoute("/_authenticated/admin/support")({
  component: SupportAdminPage,
  head: () => ({ meta: [{ title: "Support — BeyondSAT" }] }),
});

function SupportAdminPage() {
  const { staffRole } = adminRoute.useRouteContext();
  if (staffRole === "admin") return <AdminDesk />;
  return <TeacherDesk />;
}
