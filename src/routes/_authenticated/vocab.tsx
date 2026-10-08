import { createFileRoute, Outlet } from "@tanstack/react-router";
import { SectionBack } from "@/components/SectionBack";

export const Route = createFileRoute("/_authenticated/vocab")({
  component: function VocabLayout() {
    return (
      <>
        <SectionBack />
        <Outlet />
      </>
    );
  },
  head: () => ({ meta: [{ title: "Vocabulary — BeyondSAT" }] }),
});
