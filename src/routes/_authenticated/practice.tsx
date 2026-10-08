import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SectionBack } from "@/components/SectionBack";

export const Route = createFileRoute("/_authenticated/practice")({
  component: function PracticeLayout() {
    return (
      <>
        <SectionBack />
        <Outlet />
      </>
    );
  },
  head: () => ({
    meta: [
      { title: "Practice — BeyondSAT" },
      { name: "description", content: "Practice questions, daily tests, and full mock exams." },
    ],
  }),
});
