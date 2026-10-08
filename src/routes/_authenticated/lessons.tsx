import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SectionBack } from "@/components/SectionBack";

export const Route = createFileRoute("/_authenticated/lessons")({
  component: function LessonsLayout() {
    return (
      <>
        <SectionBack />
        <Outlet />
      </>
    );
  },
  head: () => ({ meta: [{ title: "Lessons — BeyondSAT" }] }),
});
