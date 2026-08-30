import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vocab")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "Vocabulary — BeyondSAT" }] }),
});
