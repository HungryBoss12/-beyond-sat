import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SectionBack } from "@/components/SectionBack";

export const Route = createFileRoute("/_authenticated/analysis")({
  component: function AnalysisLayout() {
    return (
      <>
        <SectionBack />
        <Outlet />
      </>
    );
  },
  head: () => ({ meta: [{ title: "Analysis — BeyondSAT" }] }),
});
