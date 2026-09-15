import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/vocab/tests")({
  component: () => <Outlet />,
  head: () => ({
    meta: [
      { title: "Vocab tests — BeyondSAT" },
      { name: "description", content: "Digital SAT Words-in-Context practice with timed quizzes." },
    ],
  }),
});
