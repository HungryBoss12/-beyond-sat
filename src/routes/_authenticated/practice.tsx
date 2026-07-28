import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/practice")({
  component: () => <Outlet />,
  head: () => ({
    meta: [
      { title: "Practice — BeyondSAT" },
      { name: "description", content: "Practice questions, daily tests, and full mock exams." },
    ],
  }),
});
