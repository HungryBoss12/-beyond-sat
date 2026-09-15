import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/lessons")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Lessons — BeyondSAT" }] }),
});
