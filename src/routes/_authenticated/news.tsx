import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/news")({
  component: () => <Outlet />,
  head: () => ({
    meta: [
      { title: "News — BeyondSAT" },
      { name: "description", content: "Latest announcements and study tips from BeyondSAT." },
    ],
  }),
});
