import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/practice/sqb")({
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: "SQB Tests — BeyondSAT" }] }),
});
