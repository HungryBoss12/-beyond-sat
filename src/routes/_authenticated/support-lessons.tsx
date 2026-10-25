import { createFileRoute } from "@tanstack/react-router";
import { SectionBack } from "@/components/SectionBack";
import { StudentDesk } from "@/components/support/StudentDesk";

export const Route = createFileRoute("/_authenticated/support-lessons")({
  component: SupportLessonsPage,
  head: () => ({ meta: [{ title: "Support lessons — BeyondSAT" }] }),
});

function SupportLessonsPage() {
  return (
    <div className="space-y-4">
      <SectionBack />
      <StudentDesk />
    </div>
  );
}
