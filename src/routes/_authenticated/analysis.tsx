import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/analysis")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Analysis — BeyondSAT" }] }),
});
